function exportBalanceSheetToPDF() {
    const element = document.getElementById('balance-sheet');
    if (!element) {
        showNotification('Balance Sheet report not found', 'error');
        return;
    }
    
    const clonedElement = element.cloneNode(true);
    clonedElement.style.display = 'block';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Balance Sheet</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .grid-cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                    .tab-content { display: block !important; }
                    .card-header { border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
                    @media print { 
                        body { margin: 0; } 
                        .btn { display: none; }
                        span { display: inline; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>CheckBook Pro - Balance Sheet</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()}</p>
                </div>
                ${clonedElement.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
    
    showNotification('PDF export initiated', 'success');
}

async function exportChartOfAccountsCSV() {
    try {
        const accounts = await getAccountsFromCache();
        const csvData = accounts.map(account => ({
            'Account Code': account.account_code || '',
            'Account Name': account.account_name,
            'Account Type': account.account_type,
            'Parent Code': account.parent_code || '',
            'Opening Balance': account.opening_balance || 0,
            'Current Balance': account.account_balance || 0,
            'Description': account.account_description || ''
        }));
        exportToCSV(csvData, 'chart-of-accounts.csv');
        showNotification('Chart of accounts exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting chart of accounts:', error);
        showNotification('Failed to export chart of accounts', 'error');
    }
}

    function exportProfitLossToPDF() {
    const element = document.getElementById('profit-loss');
    if (!element) {
        showNotification('Profit & Loss report not found', 'error');
        return;
    }
    
    // Create a clean copy for PDF
    const clonedElement = element.cloneNode(true);
    clonedElement.style.display = 'block';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Profit & Loss Statement</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .grid-cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
                    .tab-content { display: block !important; }
                    .card-header { border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
                    @media print { 
                        body { margin: 0; } 
                        .btn { display: none; }
                        input, select { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>CheckBook Pro - Profit & Loss Statement</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()}</p>
                </div>
                ${clonedElement.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        try {
            printWindow.print();
            showNotification('Print dialog opened - use "Save as PDF" or "Microsoft Print to PDF"', 'success');
        } catch (error) {
            showNotification('Report opened in new window - use Ctrl+P to print to PDF', 'info');
        }
        setTimeout(() => printWindow.close(), 2000);
    }, 250);
}

function exportToPDF(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) {
        showNotification('Element not found for PDF export', 'error');
        return;
    }

    // Simple PDF generation using browser print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${filename}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 20px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>CheckBook Pro Report</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()}</p>
                </div>
                ${element.outerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    
    showNotification('PDF export initiated', 'success');
}


async function loadReports(checkbookId) {
    try {
        // Calculate "This Month" date range for P&L default filter
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const [chartOfAccounts, profitLoss, transactionDetail] = await Promise.all([
            apiCall(`/reports/chart-of-accounts/${checkbookId}`),
            apiCall(`/reports/profit-loss/${checkbookId}?start_date=${startDateStr}&end_date=${endDateStr}`),
            apiCall(`/reports/transaction-detail/${checkbookId}?start_date=${startDateStr}&end_date=${endDateStr}`)
        ]);
        
        return {
            chartOfAccounts: chartOfAccounts.data || [],
            profitLoss: profitLoss.data || [],
            transactionDetail: transactionDetail.data || []
        };
    } catch (error) {
        console.error('Failed to load reports:', error);
        return {
            chartOfAccounts: [],
            profitLoss: [],
            transactionDetail: []
        };
    }
}

// Populate account dropdown for transaction detail filter with hierarchical structure
function populateTransactionDetailAccountFilter(accounts) {
    const accountSelect = document.getElementById('td-account-filter');
    if (!accountSelect) return;
    
    // Clear existing options
    accountSelect.innerHTML = '';
    
    // Add "All Accounts" option
    const allAccountsOption = document.createElement('option');
    allAccountsOption.value = '';
    allAccountsOption.textContent = 'All Accounts';
    accountSelect.appendChild(allAccountsOption);
    
    if (!accounts || accounts.length === 0) return;
    
    // Account types with colors - in proper order
    const accountTypes = {
        'asset': 'Assets',
        'liability': 'Liabilities', 
        'equity': 'Equity',
        'income': 'Income',
        'expense': 'Expenses'
    };
    
    // Add account type options (in blue)
    Object.keys(accountTypes).forEach(type => {
        const typeAccounts = accounts.filter(acc => acc.account_type === type);
        if (typeAccounts.length > 0) {
            const option = document.createElement('option');
            option.value = `type:${type}`;
            option.textContent = accountTypes[type];
            option.style.color = 'blue';
            option.style.fontWeight = 'bold';
            accountSelect.appendChild(option);
        }
    });
    
    // Find parent accounts and group them
    const parentAccounts = new Map();
    const childAccounts = [];
    
    accounts.forEach(account => {
        if (!account.parent_code) {
            // Check if this is a parent account (has children)
            const hasChildren = accounts.some(child => child.parent_code === account.account_code);
            if (hasChildren) {
                if (!parentAccounts.has(account.account_code)) {
                    parentAccounts.set(account.account_code, {
                        parent: account,
                        children: []
                    });
                }
            }
        } else {
            childAccounts.push(account);
        }
    });
    
    // Group children with their parents
    childAccounts.forEach(child => {
        if (parentAccounts.has(child.parent_code)) {
            parentAccounts.get(child.parent_code).children.push(child);
        }
    });
    
    // Add parent account options (in green)
    parentAccounts.forEach(group => {
        const option = document.createElement('option');
        option.value = `parent:${group.parent.account_code}`;
        option.textContent = group.parent.account_name;
        option.style.color = 'green';
        option.style.fontWeight = 'bold';
        accountSelect.appendChild(option);
    });
}

// Tab Navigation
function setActiveTab(element, tabId) {
    // Get the tab container
    const tabContainer = element.closest('.tabs').nextElementSibling.parentElement;
    
    // Remove active class from all tabs in this container
    element.closest('.tab-list').querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hide all tab contents in this container
    tabContainer.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to clicked tab
    element.classList.add('active');
    
    // Show selected tab content
    document.getElementById(tabId).classList.add('active');
}

function updateBalanceSheetReport(accounts) {
    // Update Assets section
    const assetsBody = document.querySelector('#balance-sheet .grid-cols-2 > div:nth-child(1) .table tbody');
    // Update Liabilities & Equity section  
    const liabilitiesBody = document.querySelector('#balance-sheet .grid-cols-2 > div:nth-child(2) .table tbody');
    
    
    if (!assetsBody || !liabilitiesBody || !accounts || assetsBody === liabilitiesBody) {
        console.error('Balance Sheet elements issue:', {assetsBody, liabilitiesBody, accountsLength: accounts?.length});
        return;
    }

    // Filter accounts by type
    const assets = accounts.filter(acc => acc.account_type === 'asset');
    const liabilities = accounts.filter(acc => acc.account_type === 'liability');
    const equity = accounts.filter(acc => acc.account_type === 'equity');
    

    // Calculate totals using calculated balance field from Chart of Accounts API
    const totalAssets = assets.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
    const totalEquity = equity.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);

    // Update Assets section
    let assetsHtml = `
        <tr style="font-weight: 600; background: #f0f9ff;">
            <td>ASSETS</td>
            <td style="text-align: right;"></td>
        </tr>
    `;
    
    if (assets.length === 0) {
        assetsHtml += `
            <tr>
                <td colspan="2" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No asset accounts found
                </td>
            </tr>
        `;
    } else {
        assetsHtml += assets.map(account => `
            <tr>
                <td>&nbsp;&nbsp;${account.account_name}</td>
                <td style="text-align: right;">${formatCurrency(parseFloat(account.balance) || 0)}</td>
            </tr>
        `).join('') + `
            <tr style="font-weight: 600; border-top: 2px solid #ddd; background: #f9fafb;">
                <td>Total Assets</td>
                <td style="text-align: right; color: var(--banking-blue);">${formatCurrency(totalAssets)}</td>
            </tr>
        `;
    }
    assetsBody.innerHTML = assetsHtml;

    // Update Liabilities & Equity section
    let liabilitiesHtml = '';
    
    // Liabilities
    if (liabilities.length > 0) {
        liabilitiesHtml += `
            <tr style="font-weight: 600; background: #fef2f2;">
                <td>LIABILITIES</td>
                <td style="text-align: right;"></td>
            </tr>
        ` + liabilities.map(account => `
            <tr>
                <td>&nbsp;&nbsp;${account.account_name}</td>
                <td style="text-align: right;">${formatCurrency(parseFloat(account.balance) || 0)}</td>
            </tr>
        `).join('') + `
            <tr style="font-weight: 600; border-bottom: 1px solid #ddd;">
                <td>Total Liabilities</td>
                <td style="text-align: right; color: var(--banking-red);">${formatCurrency(totalLiabilities)}</td>
            </tr>
            <tr style="height: 1rem;"><td colspan="2"></td></tr>
        `;
    }
    
    // Equity
    if (equity.length > 0) {
        liabilitiesHtml += `
            <tr style="font-weight: 600; background: #f0f9ff;">
                <td>EQUITY</td>
                <td style="text-align: right;"></td>
            </tr>
        ` + equity.map(account => `
            <tr>
                <td>&nbsp;&nbsp;${account.account_name}</td>
                <td style="text-align: right;">${formatCurrency(parseFloat(account.balance) || 0)}</td>
            </tr>
        `).join('') + `
            <tr style="font-weight: 600; border-bottom: 1px solid #ddd;">
                <td>Total Equity</td>
                <td style="text-align: right; color: var(--banking-blue);">${formatCurrency(totalEquity)}</td>
            </tr>
            <tr style="height: 1rem;"><td colspan="2"></td></tr>
        `;
    }
    
    // Total Liabilities & Equity
    liabilitiesHtml += `
        <tr style="font-weight: 600; border-top: 2px solid #ddd; background: #f9fafb;">
            <td>Total Liabilities & Equity</td>
            <td style="text-align: right; color: var(--banking-blue);">${formatCurrency(totalLiabilities + totalEquity)}</td>
        </tr>
    `;
    
    if (liabilities.length === 0 && equity.length === 0) {
        liabilitiesHtml = `
            <tr>
                <td colspan="2" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No liability or equity accounts found
                </td>
            </tr>
        `;
    }
    
    liabilitiesBody.innerHTML = liabilitiesHtml;
}

function updateChartOfAccountsReport(accounts) {
    const tbody = document.querySelector('#chart-of-accounts .table tbody');
    if (!tbody) return;

    if (accounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No accounts found
                </td>
            </tr>
        `;
        return;
    }

    // Group accounts by type for better chart of accounts display
    const accountGroups = ['asset', 'liability', 'equity', 'income', 'expense'];
    const typeLabels = {
        'asset': 'ASSETS',
        'liability': 'LIABILITIES', 
        'equity': 'EQUITY',
        'income': 'INCOME',
        'expense': 'EXPENSES'
    };

    let html = '';
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    accountGroups.forEach(type => {
        const typeAccounts = accounts.filter(acc => acc.account_type === type);
        if (typeAccounts.length === 0) return;

        const typeTotal = typeAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        
        // Track totals for summary
        if (type === 'asset') totalAssets = typeTotal;
        if (type === 'liability') totalLiabilities = typeTotal;
        if (type === 'equity') totalEquity = typeTotal;
        if (type === 'income') totalIncome = typeTotal;
        if (type === 'expense') totalExpenses = typeTotal;

        // Add type header
        html += `
            <tr style="font-weight: 700; background: #f1f5f9; border-top: 2px solid #e2e8f0;">
                <td></td>
                <td>${typeLabels[type]}</td>
                <td>${type.charAt(0).toUpperCase() + type.slice(1)}</td>
                <td style="font-weight: 700; text-align: right;">${formatCurrency(typeTotal)}</td>
            </tr>
        `;

        // Group accounts by parent for this account type
        const parentGroups = new Map();
        const childAccounts = [];
        const standaloneAccounts = [];

        typeAccounts.forEach(account => {
            if (!account.parent_code) {
                // This could be a parent account or standalone account
                const hasChildren = typeAccounts.some(child => child.parent_code === account.account_code);
                if (hasChildren) {
                    if (!parentGroups.has(account.account_code)) {
                        parentGroups.set(account.account_code, {
                            parent: account,
                            children: []
                        });
                    }
                } else {
                    standaloneAccounts.push(account);
                }
            } else {
                // This is a child account
                childAccounts.push(account);
            }
        });

        // Group children with their parents
        childAccounts.forEach(child => {
            if (parentGroups.has(child.parent_code)) {
                parentGroups.get(child.parent_code).children.push(child);
            } else {
                // Parent not found, treat as standalone
                standaloneAccounts.push(child);
            }
        });

        // Display parent groups with their children and parent totals
        parentGroups.forEach(group => {
            const parentTotal = (group.parent.balance || 0) + 
                                group.children.reduce((sum, child) => sum + (child.balance || 0), 0);

            // Add parent account with total
            html += `
                <tr style="font-weight: 600; background: #f8fafc;">
                    <td>${group.parent.account_code || ''}</td>
                    <td>&nbsp;&nbsp;${group.parent.account_name}</td>
                    <td>${group.parent.account_type}</td>
                    <td style="text-align: right; font-weight: 600;">${formatCurrency(parentTotal)}</td>
                </tr>
            `;

            // Add child accounts indented
            group.children.forEach(child => {
                html += `
                    <tr>
                        <td>${child.account_code || ''}</td>
                        <td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${child.account_name}</td>
                        <td>${child.account_type}</td>
                        <td style="text-align: right;">${formatCurrency(child.balance || 0)}</td>
                    </tr>
                `;
            });
        });

        // Add standalone accounts (no parent-child relationship)
        standaloneAccounts.forEach(account => {
            html += `
                <tr>
                    <td>${account.account_code || ''}</td>
                    <td>&nbsp;&nbsp;${account.account_name}</td>
                    <td>${account.account_type}</td>
                    <td style="text-align: right;">${formatCurrency(account.balance || 0)}</td>
                </tr>
            `;
        });
    });

    // Add summary totals
    html += `
        <tr style="height: 1rem;"><td colspan="4"></td></tr>
        <tr style="font-weight: 700; background: #dbeafe; border-top: 2px solid #3b82f6;">
            <td></td>
            <td>TOTAL NET WORTH</td>
            <td></td>
            <td style="font-size: 1.125rem; color: var(--banking-blue); text-align: right;">${formatCurrency(totalAssets - totalLiabilities + totalEquity)}</td>
        </tr>
    `;

    tbody.innerHTML = html;
}

// Update P&L report based on selected period
async function updateProfitLossPeriod() {
    if (!currentCheckbookId) return;
    
    try {
        const periodSelect = document.getElementById('pl-period-filter');
        const period = periodSelect.value;
        
        // Calculate date ranges
        const now = new Date();
        let startDate, endDate;
        
        if (period === 'this-month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'last-month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (period === 'this-year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else if (period === 'last-year') {
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
        }
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Load filtered P&L report
        const response = await apiCall(`/reports/profit-loss/${currentCheckbookId}?start_date=${startDateStr}&end_date=${endDateStr}`);
        updateProfitLossReport(response.data || []);
        
    } catch (error) {
        console.error('Failed to update P&L period:', error);
        showNotification('Failed to update Profit & Loss report', 'error');
    }
}

function updateProfitLossReport(accounts) {
    const tbody = document.querySelector('#profit-loss .table tbody');
    if (!tbody) return;

    // Ensure accounts is an array
    const accountsArray = Array.isArray(accounts) ? accounts : [];
    
    // Handle both detailed account data and summarized data
    let totalIncome = 0, totalExpenses = 0;
    let incomeParents = new Map(), expenseParents = new Map();
    
    if (accountsArray.length > 0 && accountsArray[0].account_name) {
        // Detailed account data - group by parent accounts for high-level summary
        const income = accountsArray.filter(acc => acc.account_type === 'income');
        const expenses = accountsArray.filter(acc => acc.account_type === 'expense');
        
        // Get all Chart of Accounts data to find parent account names
        const allAccounts = window.accountsCache || [];
        
        // Group income accounts by parent code 
        income.forEach(acc => {
            const parentCode = acc.parent_code || 'no-parent';
            const balance = acc.balance || 0;
            
            if (!incomeParents.has(parentCode)) {
                incomeParents.set(parentCode, {
                    code: parentCode,
                    name: getParentAccountName(parentCode, 'income', allAccounts),
                    balance: 0
                });
            }
            incomeParents.get(parentCode).balance += Math.abs(balance);
            totalIncome += Math.abs(balance);
        });
        
        // Group expense accounts by parent code
        expenses.forEach(acc => {
            const parentCode = acc.parent_code || 'no-parent';
            const balance = acc.balance || 0;
            
            if (!expenseParents.has(parentCode)) {
                expenseParents.set(parentCode, {
                    code: parentCode,
                    name: getParentAccountName(parentCode, 'expense', allAccounts),
                    balance: 0
                });
            }
            // For expenses: positive balance = expense, negative balance = refund (reduces total)
            expenseParents.get(parentCode).balance += balance;
            totalExpenses += balance;
        });
        
    } else {
        // Summarized data by type (fallback)
        const incomeData = accounts.find(acc => acc.account_type === 'income');
        const expenseData = accounts.find(acc => acc.account_type === 'expense');
        
        totalIncome = incomeData ? Math.abs(incomeData.total_balance || 0) : 0;
        totalExpenses = expenseData ? Math.abs(expenseData.total_balance || 0) : 0;
        
        // Create simple entries for summary view
        if (totalIncome > 0) {
            incomeParents.set('00', { code: '00', name: 'Total Income', balance: totalIncome });
        }
        if (totalExpenses > 0) {
            expenseParents.set('00', { code: '00', name: 'Total Expenses', balance: totalExpenses });
        }
    }
    
    const netIncome = totalIncome - totalExpenses;

    // Helper function to get parent account name from actual database data
    function getParentAccountName(parentCode, accountType, allAccounts) {
        if (!parentCode || parentCode === 'no-parent') {
            return 'Uncategorized';
        }
        
        // Find the actual parent account with this code
        const parentAccount = allAccounts.find(acc => 
            acc.account_code === parentCode && 
            !acc.parent_code // Parent accounts have no parent themselves
        );
        
        if (parentAccount) {
            return parentAccount.account_name;
        }
        
        // If parent not found, return the parent code
        return `Account ${parentCode}`;
    }

    // Sort parent accounts by code
    const sortedIncomeParents = Array.from(incomeParents.values()).sort((a, b) => a.code.localeCompare(b.code));
    const sortedExpenseParents = Array.from(expenseParents.values()).sort((a, b) => a.code.localeCompare(b.code));

    tbody.innerHTML = [
        // Income section header
        `<tr style="font-weight: 600; background: #dcfce7;">
            <td>INCOME</td>
            <td style="text-align: right; color: var(--banking-green);">${formatCurrency(totalIncome)}</td>
            <td style="text-align: right;">100.0%</td>
        </tr>`,
        // Income parent accounts
        ...sortedIncomeParents.map(parent => `
            <tr>
                <td>&nbsp;&nbsp;${parent.name}</td>
                <td style="text-align: right;">${formatCurrency(parent.balance)}</td>
                <td style="text-align: right;">${totalIncome > 0 ? ((parent.balance / totalIncome) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
        `),
        `<tr style="height: 1rem;"><td colspan="3"></td></tr>`,
        // Expenses section header
        `<tr style="font-weight: 600; background: #fee2e2;">
            <td>EXPENSES</td>
            <td style="text-align: right; color: var(--banking-red);">${formatCurrency(totalExpenses)}</td>
            <td style="text-align: right;">${totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : '0.0'}%</td>
        </tr>`,
        // Expense parent accounts
        ...sortedExpenseParents.map(parent => `
            <tr>
                <td>&nbsp;&nbsp;${parent.name}</td>
                <td style="text-align: right;">${formatCurrency(parent.balance)}</td>
                <td style="text-align: right;">${totalIncome > 0 ? ((parent.balance / totalIncome) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
        `),
        `<tr style="height: 1rem;"><td colspan="3"></td></tr>`,
        // Net income
        `<tr style="font-weight: 600; background: #dbeafe; border-top: 2px solid var(--banking-blue);">
            <td>NET INCOME</td>
            <td style="text-align: right; color: var(--banking-blue); font-size: 1.125rem;">${formatCurrency(netIncome)}</td>
            <td style="text-align: right; color: var(--banking-blue);">${totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0.0'}%</td>
        </tr>`
    ].join('');
}

async function updateReports() {
    if (!currentCheckbookId) return;

    try {
        showLoading('reports-page');
        
        // Reset filter selectors to their default values when page loads
        const periodSelect = document.getElementById('td-period-filter');
        const accountSelect = document.getElementById('td-account-filter');
        if (periodSelect) periodSelect.value = 'this-year';
        if (accountSelect) accountSelect.value = '';
        
        const [reports, accounts, transactions, chartOfAccountsData, balanceSheetData, profitLossData] = await Promise.all([
            loadReports(currentCheckbookId),
            getAccountsFromCache(),
            loadTransactions(currentCheckbookId),
            apiCall(`/reports/chart-of-accounts/${currentCheckbookId}`),
            apiCall(`/reports/balance-sheet/${currentCheckbookId}`),
            apiCall(`/reports/profit-loss/${currentCheckbookId}`)
        ]);
        
        // Cache all accounts for P&L parent name lookup
        window.accountsCache = accounts;
        
        updateChartOfAccountsReport(chartOfAccountsData.data);
        updateBalanceSheetReport(balanceSheetData.data);
        updateProfitLossReport(profitLossData.data);
        
        // Populate account dropdown for transaction detail filter
        populateTransactionDetailAccountFilter(accounts);
        
        // Load Transaction Detail with "This Year" filter (now the default)
        //await updateTransactionDetailPeriod();
        
        hideLoading('reports-page');
    } catch (error) {
        console.error('Failed to update reports:', error);
        hideLoading('reports-page');
    }
}
