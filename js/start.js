// Initialize Application
document.addEventListener('DOMContentLoaded', async function() {
    await populateLoginCheckbooks();
    showLogin();
    // Data will be loaded after successful login
});

async function getAccountsFromCache(forceReload = false) {
    // Check if cache is valid for current checkbook
    if (!forceReload && accountsCache && cacheTimestamp && currentCheckbookId) {
        const cacheAge = Date.now() - cacheTimestamp;
        // Cache is valid for 5 minutes or until invalidated
        if (cacheAge < 300000) {
            // console.log('📋 Using cached accounts (cache age:', Math.round(cacheAge / 1000), 'seconds)');
            return Array.isArray(accountsCache) ? accountsCache : [];
        }
    }
    
    // Load fresh data and update cache
    // console.log('🔄 Loading accounts from API and updating cache...');
    accountsCache = await loadAccounts(currentCheckbookId);
    cacheTimestamp = Date.now();
    
    // Ensure we always have an array
    if (!Array.isArray(accountsCache)) {
        console.warn('⚠️ Account cache is not an array, falling back to empty array');
        accountsCache = [];
    }
    
    // Build lookup maps for ultra-fast lookups
    accountsMap = {};
    accountsNameMap = {};
    accountsCache.forEach(account => {
        accountsMap[account.id] = account;
        accountsNameMap[account.account_name.toLowerCase()] = account;
    });
    
    // console.log(`✅ Account cache updated: ${accountsCache.length} accounts loaded`);
    return accountsCache;
}

async function handleLogin(event) {
    event.preventDefault();
    
    // Get form values
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');
    const checkbookId = formData.get('checkbook');
    
    // Debug: Log what we're sending to the API
    console.log('Login attempt:', {
        username: username,
        password: password ? '[PRESENT]' : '[MISSING]',
        checkbook_id: checkbookId
    });
    
    // Validate required fields
    if (!username || !password || !checkbookId) {
        showNotification('Please fill in all fields including checkbook selection', 'error');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;

        // Load checkbooks to get the selected one
        const checkbooks = await loadCheckbooks();
        const selectedCheckbook = checkbooks.find(cb => cb.id === checkbookId);
        if (!selectedCheckbook) {
            throw new Error('Selected checkbook not found');
        }
        
        // Use the authentication endpoint for login
        const authResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                checkbook_id: checkbookId
            })
        });
        
        if (!authResponse.ok) {
            const errorData = await authResponse.json();
            console.log('Authentication failed:', errorData.message);
            throw new Error(errorData.message || 'Invalid credentials');
        }
        
        const authResult = await authResponse.json();
        const authenticatedUser = authResult.data;
        // console.log('Authentication successful for user:', authenticatedUser.username);
        currentUser = {
            id: authenticatedUser.id,
            username: authenticatedUser.username,
            user_role: authenticatedUser.user_role,
            checkbook_id: authenticatedUser.checkbook_id
        };
        currentCheckbookId = checkbookId;
        
        // Clear account cache when switching checkbooks
        invalidateAccountsCache('Switched to different checkbook');
        
        // Pre-load accounts into cache for immediate use
        await getAccountsFromCache();

        // Update sidebar with checkbook name
        const sidebarCheckbook = document.querySelector('.sidebar-header p');
        if (sidebarCheckbook) {
            sidebarCheckbook.textContent = selectedCheckbook?.checkbook_name || 'Unknown Checkbook';
        }

        // Update navigation based on user role
        const adminNavItem = document.getElementById('admin-nav-item');
        if (adminNavItem) {
            if (currentUser.user_role === 'admin') {
                adminNavItem.style.display = 'block';
            } else {
                adminNavItem.style.display = 'none';
            }
        }
        
        // Show app and load dashboard
        showApp();
        await showPage('dashboard');
        
    } catch (error) {
        console.error('Login failed:', error);
        showNotification(error.message || 'Login failed', 'error');
    } finally {
        // Reset button state
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Sign In';
        submitBtn.disabled = false;
    }
}

function invalidateAccountsCache(reason = 'Account data changed') {
    // console.log(`🗑️ Invalidating account cache: ${reason}`);
    accountsCache = null;
    accountsMap = {};
    accountsNameMap = {};
    cacheTimestamp = null;
}

async function loadAccounts(checkbookId) {
    try {
        // Add cache-busting to prevent stale data issues like we had with checkbooks
        const response = await apiCall(`/accounts/checkbook/${checkbookId}?_cb=${Date.now()}`);
        
        // Server returns the array directly, not wrapped in data property
        const accounts = Array.isArray(response) ? response : response.data || [];
        
        // Ensure numeric fields are properly coerced to numbers for calculations and display
        const processedAccounts = accounts.map(account => ({
            ...account,
            opening_balance: Number(account.opening_balance || 0),
            account_balance: Number(account.account_balance || 0)
        }));
        
        return processedAccounts;
    } catch (error) {
        console.error('Failed to load accounts:', error);
        return [];
    }
}

async function loadBalances(checkbookId) {
    try {
        // Load YTD, MTD data from APIs and accounts from existing sources
        const [ytdResponse, mtdResponse, accounts] = await Promise.all([
            apiCall(`/reports/dashboard-ytd/${checkbookId}`),
            apiCall(`/reports/dashboard-mtd/${checkbookId}`),
            loadAccounts(checkbookId)
        ]);
        
        // Extract YTD data from API response
        const ytdData = ytdResponse.data || {};
        const ytdIncome = ytdData.ytdIncome || 0;
        const ytdExpenses = ytdData.ytdExpenses || 0;
        
        // Calculate total assets and liabilities from account balances
        let totalAssets = 0;
        let totalLiabilities = 0;
        accounts.forEach(account => {
            const balance = parseFloat(account.account_balance) || 0;
            if (account.account_type === 'asset') {
                totalAssets += balance;
            } else if (account.account_type === 'liability') {
                totalLiabilities += balance;
            }
        });
        
        // Extract MTD data from API response
        const mtdData = mtdResponse.data || {};
        const mtdIncome = mtdData.mtdIncome || 0;
        const mtdExpenses = mtdData.mtdExpenses || 0;
        
        return {
            mtdIncome,
            mtdExpenses,
            ytdIncome,
            ytdExpenses,
            totalAssets,
            totalLiabilities
        };
    } catch (error) {
        console.error('Failed to load balances:', error);
        return {
            mtdIncome: 0,
            mtdExpenses: 0,
            ytdIncome: 0,
            ytdExpenses: 0,
            totalAssets: 0,
            totalLiabilities: 0
        };
    }
}

async function loadCheckbooks() {
    try {
        // console.log('Loading checkbooks from API...');
        const response = await apiCall('/checkbooks');
        // console.log('Checkbooks API response:', response);
        // Server returns the array directly, not wrapped in data property
        const checkbooks = Array.isArray(response) ? response : response.data || [];
        // console.log('Processed checkbooks:', checkbooks);
        return checkbooks;
    } catch (error) {
        console.error('Failed to load checkbooks:', error);
        return [];
    }
}

async function loadTransactions(checkbookId, loadAll = true) {
    try {
        const url = loadAll ? `/transactions/checkbook/${checkbookId}?all=true` :  `/transactions/checkbook/${checkbookId}`;
        // console.log('🌐 Loading transactions from:', url);
        const response = await apiCall(url);
        /*
        console.log('📡 Raw API response:', { 
            isArray: Array.isArray(response),
            hasData: response?.data,
            dataLength: response?.data?.length,
            response: response
        });
        */
        // Server returns the array directly, not wrapped in data property
        const transactions = Array.isArray(response) ? response : response.data || [];
        // console.log('✅ Parsed transactions:', transactions.length, 'items');
        return transactions;
    } catch (error) {
        console.error('❌ Failed to load transactions:', error);
        return [];
    }
}

function logout() {
    // Clear password field but keep username and checkbook selection
    const passwordField = document.querySelector('#login-page input[name="password"]');
    if (passwordField) {
        passwordField.value = '';
    }
    
    showLogin();
}

async function populateLoginCheckbooks() {
    try {
        const checkbooks = await loadCheckbooks();
        const select = document.getElementById('login-checkbook-select');
        if (select && checkbooks.length > 0) {
            select.innerHTML = '<option value="">Select checkbook</option>' +
                checkbooks.map(cb => `<option value="${cb.id}">${cb.checkbook_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load checkbooks for login:', error);
    }
}

function showApp() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('app-layout').classList.add('active');
}

function showLogin() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('app-layout').classList.remove('active');
}

async function showPage(pageId) {
    // Check admin access for admin page
    if (pageId === 'admin' && currentUser && currentUser.user_role !== 'admin') {
        showNotification('Access denied. Admin privileges required.', 'error');
        return;
    }
    // Hide all pages
    document.querySelectorAll('.main-content .page').forEach(page => {
        page.classList.remove('active');
    });
    // Show selected page
    // console.log('PageId', pageId);
    document.getElementById(pageId + '-page').classList.add('active');
    currentPage = pageId;

    // Load data for the specific page
    switch (pageId) {
        case 'dashboard':
            await updateDashboard();
            break;
        case 'register':
            await updateRegister();
            break;
        case 'transactions':
            await updateTransactionsReport();
            break;
        case 'reports':
            await updateReports();
            break;
        case 'admin':
            await updateAdminPanel();
            break;
    }
}

function updateBalanceCards(balances) {
    // Update MTD card
    const mtdIncome = document.getElementById('mtd-income');
    const mtdExpenses = document.getElementById('mtd-expenses');
    const mtdNet = document.getElementById('mtd-net');
    
    if (mtdIncome) mtdIncome.textContent = formatCurrency(balances.mtdIncome || 0);
    if (mtdExpenses) mtdExpenses.textContent = formatCurrency(balances.mtdExpenses || 0);
    if (mtdNet) {
        const net = (balances.mtdIncome || 0) - (balances.mtdExpenses || 0);
        mtdNet.textContent = formatCurrency(net);
        mtdNet.className = `font-bold ${net >= 0 ? 'text-banking-green' : 'text-banking-red'}`;
    }

    // Update YTD card
    const ytdIncome = document.getElementById('ytd-income');
    const ytdExpenses = document.getElementById('ytd-expenses');
    const ytdNet = document.getElementById('ytd-net');        
    
    if (ytdIncome) ytdIncome.textContent = formatCurrency(balances.ytdIncome || 0);
    if (ytdExpenses) ytdExpenses.textContent = formatCurrency(balances.ytdExpenses || 0);
    if (ytdNet) {
        const net = (balances.ytdIncome || 0) - (balances.ytdExpenses || 0);
        ytdNet.textContent = formatCurrency(net);
        ytdNet.className = `font-bold ${net >= 0 ? 'text-banking-green' : 'text-banking-red'}`;
    }
}

async function updateDashboard() {
    if (!currentCheckbookId) return;

    try {
        showLoading('dashboard-page');
        
        const [balances, transactions] = await Promise.all([
            loadBalances(currentCheckbookId),
            loadTransactions(currentCheckbookId)
        ]);

        // Update balance cards
        updateBalanceCards(balances);
        
        // Update recent transactions table
        updateRecentTransactions(transactions.slice(0, 5));
        
        hideLoading('dashboard-page');
    } catch (error) {
        console.error('Failed to update dashboard:', error);
        hideLoading('dashboard-page');
    }
}

function updateRecentTransactions(transactions) {
    const tbody = document.querySelector('#recent-transactions-table tbody');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No transactions found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        
        // Simple debit/credit logic for Recent Transactions
        // Credit = positive (green), Debit = negative (red)
        const isCredit = transaction.transaction_type === 'credit';
        const displayAmount = isCredit ? amount : -amount;
        const amountColor = isCredit ? 'var(--banking-green)' : 'var(--banking-red)';

        //console.log('Rendering transaction:', transaction.id, 'Date:', transaction.transaction_date);
        
        return `
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 0.75rem; font-size: 0.875rem;">${formatDate(transaction.transaction_date)}</td>
                <td style="padding: 0.75rem; font-size: 0.875rem;">${transaction.from_account_name || getAccountName(transaction.from_account_id) || 'Unknown'}</td>
                <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--banking-blue);">${transaction.to_account_name || getAccountName(transaction.to_account_id) || '-'}</td>
                <td style="padding: 0.75rem; font-size: 0.875rem;">${transaction.description || transaction.reference_number || '-'}</td>
                <td style="padding: 0.75rem; text-align: right; font-weight: 600; color: ${amountColor};">
                    ${displayAmount < 0 ? '-' : '+'}${formatCurrency(Math.abs(displayAmount))}
                </td>
            </tr>
        `;
    }).join('');
    // Save date of the first transaction row.
    const topDate = tbody.querySelector('tr td')?.textContent;
    // Convert string to a Date object
    const topDateObj = new Date(topDate);
    // Format it to YYYY-MM-DD
    preservedDate = topDateObj.toISOString().split('T')[0];

    //console.log("Date from the first TD:", preservedDate);
}