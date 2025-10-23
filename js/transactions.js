async function editTransactionFromPage(transactionId) {
    try {
        const transaction = await loadTransactionById(transactionId);
        const editModal = document.getElementById('edit-transaction-modal');
        editModal.setAttribute('data-return-source', 'transaction-page');
        
        await populateEditTransactionModal(transaction);
        openModal('edit-transaction-modal');
    } catch (error) {
        console.error('Error opening edit transaction modal from reconcile:', error);
        showNotification('Failed to load transaction for editing', 'error');
    }

}

function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('CSV exported successfully', 'success');
}

async function exportTransactionsCSV() {
    try {

        transactions = filteredRawTransactions || [];
        if (transactions.length === 0) {
            const message = hasActiveFilters ? 'No transactions to export with current filters' : 'No transactions found to export';
            showNotification(message, 'warning');
            return;
        }
               
        const csvData = transactions.map(transaction => ({
            'Date': formatDate(transaction.transaction_date),
            'From Account': transaction.from_account_name || getAccountName(transaction.from_account_id) || '',
            'To Account': transaction.to_account_name || getAccountName(transaction.to_account_id) || '',
            'Reference': transaction.reference_number || '',
            'Description': transaction.description || '',
            'Amount': transaction.amount,
            'Transaction Type': transaction.transaction_type || 'credit',
            'Status': transaction.is_reconciled ? 'Cleared' : 'Pending'
        }));
        
        const filename = 'transactions_exported.csv';
        exportToCSV(csvData, filename);
        showNotification(`${transactions.length} transactions exported successfully`, 'success');
    } catch (error) {
        console.error('Error exporting transactions:', error);
        showNotification('Failed to export transactions', 'error');
    }
}

async function exportTransactionsPDF(reportData, reportTitle, cols) {
    const table = document.getElementById(reportData);
    if (!table) {
        showNotification('Transactions Detail Table not found', 'error');
        return;
    }
    
    // Get current checkbook name for the header
    let checkbookName = 'Unknown Checkbook';
    try {
        const checkbooks = await loadCheckbooks();
        const currentCheckbook = checkbooks.find(cb => cb.id === currentCheckbookId);
        if (currentCheckbook) {
            checkbookName = currentCheckbook.checkbook_name;
        }
    } catch (error) {
        console.error('Failed to load checkbook name for export:', error);
    }

    const headers = [];
    const data = [];
    const dataStyle = []

      // Extract headers
    const headerRows = table.querySelectorAll('thead tr th');
    headerRows.forEach((th, index) => {
        const thText = th.innerText;
        if(thText === 'Amount' || thText === 'Date') {
            dataStyle.push('right');
        } else if(thText === 'Action') {
            dataStyle.push('none');
        } else {
            dataStyle.push('left');
        }
    });
    headerRows.forEach((th, index) => {
        const thText = th.innerText;
        if(thText != 'Action') {
            headers.push({ text: th.innerText, alignment: dataStyle[index], style: 'tableHeader' });
        }
    });
    //console.log('headerRows:', headerRows)

    // Extract data
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach((td, index) => {
            if(dataStyle[index] != 'none') {
                rowData.push({ text: td.innerText, alignment: dataStyle[index], style: 'tableData' });
            }
        });
        data.push(rowData);
    });
    // console.log('dataRows:', dataRows)

    const tableBody = [headers, ...data];
    const today = new Date();

    const docDefinition = {
        header: {
            text: reportTitle + ' - ' + checkbookName,
            alignment: 'center',
            fontSize: 16,
            margin: [0, 20, 0, 0] // Top margin
        },
        footer: function(currentPage, pageCount) {
            return {
                text: `Page ${currentPage} of ${pageCount}`,
                alignment: 'right',
                margin: [0, 0, 40, 20],   // right and bottom margin
                fontSize: 10 
            };
        },
        content: [
            { 
                // Subtitle for the date
                text: `${today.toLocaleDateString()}`,
                alignment: 'center',
                fontSize: 10
            },
            {
                table: {
                    headerRows: 1,
                    body: tableBody,
                    style: 'tableData'
                },
                layout: 'lightHorizontalLines',
            }
        ],
        styles: {
            header: {
                bold: true,
            },
            tableHeader: {
                bold: true,
                fontSize: 14
            },
            tableData: {
                fontSize: 9
            }
        }
    };
    //pdfMake.createPdf(docDefinition).download(reportTitle + '.pdf');
    pdfMake.createPdf(docDefinition).open();

}

function importTransactionsCSV() {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            await processCSVImport(text);
        } catch (error) {
            console.error('Error importing CSV:', error);
            showNotification('Failed to import CSV file', 'error');
        }
    };
    input.click();
}


function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        
        if (char === '"') {
            if (!inQuotes) {
                // Starting quotes
                inQuotes = true;
            } else if (i + 1 < line.length && line[i + 1] === '"') {
                // Escaped quote (two quotes in a row)
                current += '"';
                i++; // Skip the next quote
            } else {
                // Ending quotes
                inQuotes = false;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator outside of quotes
            result.push(current.trim());
            current = '';
        } else {
            // Regular character (including quotes inside quoted fields)
            current += char;
        }
        i++;
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
}

function populateTransactionsFilter(accounts) {

    const accountSelect = document.getElementById('td-account-filter');
    accountSelect.innerHTML = '';

    let selectOptions = [                             // category, value, textContent, color
        ['', '', 'All Accounts', 'black'],
        ['type:', 'asset', 'Assets', 'blue'],
        ['type:', 'liability', 'Liabilities', 'blue'],
        ['type:', 'equity', 'Equity', 'blue'],               
        ['type:', 'income', 'Income', 'blue'],
        ['type:', 'expense', 'Expenses', 'blue']               
    ];

    accounts[0].forEach(record => {
        if(record.parent_code == null) {
            const option = ['parent:', record.account_code, record.account_name, , 'green']
            selectOptions.push(option);
        } 
    });

    //console.log('', selectOptions);

    selectOptions.forEach(line => {
        const option = document.createElement('option');
        option.value = line[0] + line[1];
        option.textContent = line[2];
        option.style.color = line[3];
        option.style.fontWeight = 'bold';
        accountSelect.appendChild(option);
    });
}
        
async function processCSVImport(csvText) {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must contain headers and at least one data row');
        }

        const headers = parseCSVLine(lines[0]);
        const requiredHeaders = ['Date', 'From Account', 'To Account', 'Amount'];
        // Transaction Type is optional - will default to 'credit' if not present
        
        // console.log('CSV Headers found:', headers);
        // console.log('Required headers:', requiredHeaders);
        
        // Check if required headers exist
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        // Load accounts for name-to-ID mapping
        const accounts = await getAccountsFromCache();
        const accountMap = {};
        accounts.forEach(account => {
            accountMap[account.account_name.toLowerCase()] = account;
        });

        const validTransactions = [];
        const errors = [];

        // Process each data row and collect valid transactions
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCSVLine(lines[i]);
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = values[index] || '';
                });
                
                // Map account names to IDs
                const fromAccount = accountMap[rowData['From Account'].toLowerCase()];
                const toAccount = accountMap[rowData['To Account'].toLowerCase()];

                if (!fromAccount) {
                    throw new Error(`From Account "${rowData['From Account']}" not found`);
                }
                if (!toAccount) {
                    throw new Error(`To Account "${rowData['To Account']}" not found`);
                }

                // Parse and format date to ISO format
                let transactionDate;
                try {
                    const parsedDate = new Date(rowData['Date']);
                    if (isNaN(parsedDate.getTime())) {
                        throw new Error('Invalid date format');
                    }
                    transactionDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                } catch (dateError) {
                    throw new Error(`Invalid date "${rowData['Date']}". Use format like "Feb 4, 2025" or "2025-02-04"`);
                }

                // Parse amount
                const amount = parseFloat(rowData['Amount']);
                if (isNaN(amount) || amount === 0) {
                    throw new Error(`Invalid amount: ${rowData['Amount']}`);
                }

                // Determine transaction type from CSV or amount sign
                let transactionType = 'credit'; // default
                if (rowData['Transaction Type']) {
                    transactionType = rowData['Transaction Type'].toLowerCase();
                } else {
                    // Fallback: determine from amount sign if no Transaction Type column
                    transactionType = amount >= 0 ? 'credit' : 'debit';
                }

                    // Determine transaction status
                let status = 0; // default
                if (rowData['Status']) {
                    const statusCode = rowData['Status'].toLowerCase();
                    if(statusCode == "cleared") status = 1;
                }

                // Create transaction object with all required fields (note: checkbook_id added by bulk endpoint)
                const transactionData = {
                    transaction_type: transactionType,
                    transaction_date: transactionDate,
                    from_account_id: fromAccount.id,
                    to_account_id: toAccount.id,
                    amount: Math.abs(amount), // API expects positive amount
                    reference_number: rowData['Reference'] || '',
                    description: rowData['Description'] || '',
                    is_reconciled: status
                };

                validTransactions.push(transactionData);
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }

        // Show validation errors if any
        if (errors.length > 0) {
            console.error('Validation errors:', errors);
            showNotification(`${errors.length} rows had validation errors. Check console for details.`, 'warning');
        }

        // Proceed with bulk import if we have valid transactions
        if (validTransactions.length > 0) {
            // console.log(`📦 Starting bulk import of ${validTransactions.length} valid transactions...`);
            
            try {
                // Use new bulk import endpoint for massive performance improvement
                const response = await apiCall('/transactions/bulk-import', 'POST', {
                    transactions: validTransactions,
                    checkbook_id: currentCheckbookId
                });

                // Handle bulk import response with detailed statistics
                if (response.status === 'success') {
                    const stats = response.data;
                    let successMessage = `✅ Bulk import completed: ${stats.inserted} new transactions imported`;
                    
                    if (stats.duplicates_skipped > 0) {
                        successMessage += `, ${stats.duplicates_skipped} duplicates skipped`;
                    }
                    
                    showNotification(successMessage, 'success');
                    // console.log('📊 Bulk import statistics:', stats);
                    
                    // Refresh the transactions table to show new data
                    await updateTransactions();
                    // Always refresh dashboard to update account balances
                    await updateDashboard();
                    // Invalidate Accounts Cache
                    invalidateAccountsCache('ImportCSV Changed Account Balances');

                    
                } else {
                    throw new Error(response.message || 'Bulk import failed');
                }
                
            } catch (bulkError) {
                console.error('Bulk import error:', bulkError);
                showNotification(`Bulk import failed: ${bulkError.message}`, 'error');
            }
        } else {
            showNotification('No valid transactions to import', 'warning');
        }

    } catch (error) {
        console.error('CSV processing error:', error);
        showNotification(`Import failed: ${error.message}`, 'error');
    }
}

async function updateTransactionsReport() {

    const accounts = await Promise.all([
        getAccountsFromCache()
    ]);

    // Populate account dropdown for transaction detail filter
    populateTransactionsFilter(accounts);
    
    // Load Transaction Detail with "This Year" filter (now the default)
    await updateTransactionsPeriod();
}

let filteredRawTransactions = [];
async function updateTransactionsPeriod() {

        if (!currentCheckbookId) {
        console.warn('updateTransactionsPeriod: No checkbook ID');
        return;
    }
    
    try {
        const periodSelect = document.getElementById('td-period-filter');
        const accountSelect = document.getElementById('td-account-filter');
        
        if (!periodSelect || !accountSelect) {
            console.error('updateTransactionsPeriod: DOM elements not found', {
                periodSelect: !!periodSelect,
                accountSelect: !!accountSelect
            });
            return;
        }
        
        const period = periodSelect.value || 'this-year'; // Default fallback
        const filterValue = accountSelect.value || '';
        
        // console.log('updateTransactionDetailPeriod called with:', { period, filterValue, currentCheckbookId });
        
        // Calculate date ranges - force to 2025 since that's where our data is
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
        
        // console.log('Date range calculated:', { startDateStr, endDateStr });
        
        // Build query parameters
        let queryParams = `start_date=${startDateStr}&end_date=${endDateStr}`;
        
        // Handle different filter types
        if (filterValue) {
            if (filterValue.startsWith('type:')) {
                // Filter by account type
                const accountType = filterValue.replace('type:', '');
                queryParams += `&account_type=${accountType}`;
            } else if (filterValue.startsWith('parent:')) {
                // Filter by parent account code - we need to get all accounts with this parent code
                const parentCode = filterValue.replace('parent:', '');
                queryParams += `&parent_code=${parentCode}`;
            } else {
                // Individual account ID (backward compatibility)
                queryParams += `&account_id=${filterValue}`;
            }
        }
        
        const apiUrl = `/reports/transaction-detail/${currentCheckbookId}?${queryParams}`;
        // console.log('Making API call to:', apiUrl);
        
        // Load filtered transaction detail report
        const response = await apiCall(apiUrl);

        /*
        console.log('API response received:', { 
            status: response?.status, 
            dataLength: response?.data?.length,
            hasData: !!(response?.data && response.data.length > 0)
        });
        */
        
        await updateTransactionsPage(response.data || []);
        
    } catch (error) {
        console.error('Failed to update transaction detail period:', error);
        showNotification('Failed to update Transaction Detail report', 'error');
    }
}


async function updateTransactionsPage(transactions) {

    //console.log(transactions);
    filteredRawTransactions = transactions;

    const tbody = document.querySelector('#transactions-page .table tbody');
    if (!tbody) {
        console.error('Transaction detail tbody not found!');
        return;
    }

    if (!transactions || transactions.length === 0) {
        // console.log('No transactions to display, showing empty message');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No transactions found for the selected date range
                </td>
            </tr>
        `;
        return;
    }

    // Load accounts data for getAccountName function
    let fullAccountsData = [];
    window.fullAccountsData = fullAccountsData; // Make it globally accessible
    try {
        fullAccountsData = await getAccountsFromCache();
    } catch (error) {
        console.error('Failed to load accounts for transaction detail report:', error);
    }

    // Convert each transaction into proper double-entry format based on accounting rules
    const doubleEntryTransactions = [];

    let x = 0;
    transactions.forEach(transaction => {
        let amount = parseFloat(transaction.amount) || 0;
        const date = transaction.transaction_date;
        const reference = transaction.reference_number || '-';
        const description = transaction.description || '';
        const transactionType = transaction.transaction_type; // 'credit' or 'debit'


        const getMissingDetails = (transaction, fullAccountsData) => {
            const fromAccount = fullAccountsData.find(acc => acc.id === transaction.from_account_id);
            const toAccount = fullAccountsData.find(acc => acc.id === transaction.to_account_id);
            if (!fromAccount || !toAccount) {
                return null; // Handle cases where accounts aren't found
            }
            return {
                from: { name: fromAccount.account_name, code: fromAccount.account_code, parent: fromAccount.parent_code, category: fromAccount.account_type },
                to: { name: toAccount.account_name, code: toAccount.account_code, parent: toAccount.parent_code, category: toAccount.account_type }
            };
        };

        const fromToDetails = getMissingDetails(transaction, fullAccountsData);
        const catNumber = {'asset': 1, 'liability': 2, 'equity': 3, 'income': 4, 'expense': 5};
        let cat = catNumber[fromToDetails.from.category];
        if(cat === 2 ) {
            amount = transactionType === 'debit' ? amount : amount * -1;
        } else {
            amount = transactionType === 'debit' ? amount * -1 : amount;
        }

        // Create Proper Double Entry Rows
        doubleEntryTransactions.push({
            amount: amount,
            id: transaction.id,
            name: fromToDetails.from.name,                   
            code: fromToDetails.from.code,
            parent: fromToDetails.from.parent,
            category: fromToDetails.from.category,        /* assets, liabilites, etc. */
            counter: fromToDetails.to.name,
            date: date,
            description: description,
            reference: reference,
            dc: transactionType,
            cat: cat                                     /* category number */
        });

        cat = catNumber[fromToDetails.to.category];
        doubleEntryTransactions.push({
            amount: amount,
            id: transaction.id,
            name: fromToDetails.to.name,                   
            code: fromToDetails.to.code,
            parent: fromToDetails.to.parent,
            category: fromToDetails.to.category,
            counter: fromToDetails.from.name,
            date: date,
            description: description,
            reference: reference,
            dc: transactionType,
            cat: cat
        });

    });

    doubleEntryTransactions.sort((a, b) => {
        // Sort by cat (category) 1. Assets, 2. Liabilities, etc.
        if (a.cat < b.cat) { return -1; };
        if (a.cat > b.cat) { return  1; };
        // When equal sort by parent
        if (a.parent < b.parent) { return -1; };
        if (a.parent > b.parent) { return  1; };
        // When equal sort by account_code
        if (a.code < b.code) { return -1; };
        if (a.code > b.code) { return  1; };
        // When equal sort by date
        if (a.date < b.date) { return -1; };
        if (a.date > b.date) { return  1; };
        // all equal
        return 0;
    });

    /****Filter by Category or Parent******/

    const currentAccountFilter = document.getElementById('td-account-filter')?.value;
    let filteredTransactions;

    if (currentAccountFilter) {
        if (currentAccountFilter.startsWith('type:')) {

            // Filter by cat (category)
            const filterAccountType = currentAccountFilter.replace('type:', '');
            filteredTransactions = doubleEntryTransactions.filter(entry => {
                return entry.category === filterAccountType;
            });

        } else if (currentAccountFilter.startsWith('parent:')) {

            // Filter by parent account code
            const filterParentCode = currentAccountFilter.replace('parent:', '');
            filteredTransactions = doubleEntryTransactions.filter(entry => {
                return entry.parent === filterParentCode;
            });
            
        } 
    } else {
        filteredTransactions = doubleEntryTransactions;
    }

    /***************Create Groups******************/

    // Group entries cat, parent, child
    const groups = new Map();
    filteredTransactions.forEach(transaction => {

        // Create cat group and add to total
        if (!groups.has(transaction.cat)) {                     
            groups.set(transaction.cat, {
                group: "cat",
                catCode: transaction.cat,
                catTotal: 0
            });
        };
        groups.get(transaction.cat).catTotal += transaction.amount;

        // Create parent group and add to total
        if (!groups.has(transaction.parent)) {                     
            groups.set(transaction.parent, {
                group: "parent",
                parentCode: transaction.parent,
                parentTotal: 0
            });
        };
        groups.get(transaction.parent).parentTotal += transaction.amount;

        // Create code (account) group and add to total
        if (!groups.has(transaction.code)) {                     
            groups.set(transaction.code, {
                group: "code",
                codeName: transaction.name,
                codeCode: transaction.code,
                codeTotal: 0,
                transactions: []
            });
        };
        groups.get(transaction.code).codeTotal += transaction.amount;
        groups.get(transaction.code).transactions.push(transaction);
        

    });

    /***********Build Report****************/

    let html = '';
    groups.forEach(group => {

        const catLabels = {'1': 'ASSETS', '2': 'LIABILITIES', '3': 'EQUITY', '4': 'INCOME', '5': 'EXPENSES' };
        if(group.group === "cat") {
            // category header
            html += `
                <tr style="font-weight: 700; background: #1e40af; color: white; border-top: 3px solid #1e40af;">
                    <td style="padding: 1rem; font-size: 1.125rem; font-weight: 700; letter-spacing: 0.05em;">${catLabels[group.catCode]}</td>
                    <td></td> 
                    <td></td> 
                    <td></td> 
                    <td style="padding: 0.75rem; text-align: right; font-weight: 700; font-size: 1rem; color: ${group.catTotal >= 0 ? 'var(--banking-green)' : 'var(--banking-red)'};">${group.catTotal >= 0 ? '+' : ''}${formatCurrency(Math.abs(group.catTotal))}</td>
                    <td></td>                           
                </tr>
            `;
        }

        if(group.group === "parent") {

            const parentCode = group.parentCode;
            const getParentName = (parentCode, fullAccountsData) => {
                const accounts = fullAccountsData.find(acc => acc.account_code === parentCode);
                return accounts.account_name;
            };
            const parentName = getParentName(parentCode, fullAccountsData);

            // parent header
            html += `
                <tr style="font-weight: 600; background: #f8fafc; border-left: 4px solid var(--banking-blue);">
                    <td style="padding: 0.75rem; font-weight: 600;">${group.parentCode}</td>
                    <td style="padding: 0.75rem; font-weight: 600; padding-left: 1.5rem;">${parentName}</td>
                    <td style="padding: 0.75rem;"></td>
                    <td style="padding: 0.75rem;"></td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 700; font-size: 1rem; color: ${group.parentTotal >= 0 ? 'var(--banking-green)' : 'var(--banking-red)'};">
                        ${group.parentTotal >= 0 ? '+' : ''}${formatCurrency(Math.abs(group.parentTotal))}
                    </td>
                    <td></td>     
                </tr>
            `;
        }

        if(group.group === "code") {

            // code (account) header
            html += `
                <tr style="background: #f1f5f9; font-weight: 500;">
                    <td style="padding: 0.75rem; padding-left: 2rem; font-weight: 500;">${group.codeCode}</td>
                    <td style="padding: 0.75rem; padding-left: 2.5rem; font-weight: 500;">${group.codeName}</td>
                    <td style="padding: 0.75rem;"></td>
                    <td style="padding: 0.75rem;"></td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 600; color: ${group.codeTotal >= 0 ? 'var(--banking-green)' : 'var(--banking-red)'};">
                        ${group.codeTotal >= 0 ? '+' : ''}${formatCurrency(Math.abs(group.codeTotal))}
                    </td>
                    <td></td>                                 
                </tr>
            `;

            // Individual transactions for this account
            group.transactions.forEach(transaction => {
                const amount = transaction.amount;
                let displayColor = amount < 0 ? 'var(--banking-red)' : '#1f2937';
                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: #fefefe;">
                        <td style="padding: 0.75rem; font-size: 0.875rem; color: #6b7280; padding-left: 3rem;">${formatDate(transaction.date)}</td>
                        <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--banking-blue); padding-left: 3.5rem;">${transaction.counter}</td>
                        <td style="padding: 0.75rem; font-size: 0.875rem; color: #6b7280;">${transaction.reference}</td>
                        <td style="padding: 0.75rem; font-size: 0.875rem; color: #6b7280;">${transaction.description}</td>
                        <td style="padding: 0.75rem; font-size: 0.875rem; text-align: right; font-weight: 600; color: ${displayColor};">
                            ${amount < 0 ? '(' : ''}${formatCurrency(Math.abs(amount))}${amount < 0 ? ')' : ''}
                        </td>
                        <td style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="editTransactionFromPage('${transaction.id}')">Edit</button>
                        </td>
                    </tr>
                `;
            });
        };
    });
    tbody.innerHTML = html;
};








       