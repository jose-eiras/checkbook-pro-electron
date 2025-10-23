async function deleteAccount(accountId) {
    try {
        // Load account details for confirmation like we do for users/checkbooks
        const accounts = await getAccountsFromCache();
        const account = accounts.find(acc => acc.id === accountId);
        
        const details = document.querySelector('#delete-item-details > div:last-child');
        details.innerHTML = `
            <div><strong>Account Code:</strong> ${account?.account_code || 'Unknown'}</div>
            <div><strong>Account Name:</strong> ${account?.account_name || 'Unknown'}</div>
            <div><strong>Account Type:</strong> ${account?.account_type || 'Unknown'}</div>
            <div><strong>Current Balance:</strong> $${((account?.account_balance || 0) + (account?.opening_balance || 0)).toFixed(2)}</div>
            <div style="color: #dc2626; font-weight: 500; margin-top: 0.5rem;">
                ⚠️ This action cannot be undone. All data will be permanently deleted.
            </div>
        `;
        
        const modal = document.getElementById('delete-confirmation');
        modal.setAttribute('data-delete-type', 'account');
        modal.setAttribute('data-delete-id', accountId);
        
        openModal('delete-confirmation');
    } catch (error) {
        console.error('Error preparing account deletion:', error);
        showNotification('Failed to load account details', 'error');
    }
}


async function deleteCheckbook(checkbookId) {
    // console.log('deleteCheckbook called with ID:', checkbookId);
    try {
        // Get checkbook details for confirmation
        const checkbooks = await loadCheckbooks();
        const checkbook = checkbooks.find(cb => cb.id === checkbookId);
        
        // Use the same professional modal as User management
        const details = document.querySelector('#delete-item-details > div:last-child');
        details.innerHTML = `
            <div><strong>Checkbook:</strong> ${checkbook ? checkbook.checkbook_name : 'Unknown'}</div>
            <div><strong>Description:</strong> ${checkbook?.description || 'None'}</div>
            <div style="color: #dc2626; font-weight: 500; margin-top: 0.5rem;">
                ⚠️ This action cannot be undone. All data will be permanently deleted.
            </div>
        `;
        
        const modal = document.getElementById('delete-confirmation');
        modal.setAttribute('data-delete-type', 'checkbook');
        modal.setAttribute('data-delete-id', checkbookId);
        
        openModal('delete-confirmation');
        
    } catch (error) {
        console.error('Error in deleteCheckbook:', error);
        showNotification('Failed to delete checkbook', 'error');
    }
}


async function deleteUser(userId) {
    // Protect ROWID 1
    if (userId === 1 || userId === '1') {
        showNotification('This user cannot be deleted (protected system user)', 'error');
        return;
    }
    
    const details = document.querySelector('#delete-item-details > div:last-child');
    details.innerHTML = `
        <div><strong>Username:</strong> Loading...</div>
    `;
    
    // Load user data from users array to show in confirmation
    try {
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const users = usersData.data || [];
            const user = users.find(u => u.id === userId);
            
            if (user) {
                details.innerHTML = `
                    <div><strong>Username:</strong> ${user.username}</div>
                    <div><strong>Role:</strong> ${user.user_role}</div>
                    <div><strong>Checkbook:</strong> ${user.checkbook_name}</div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading user for delete confirmation:', error);
    }
    
    const modal = document.getElementById('delete-confirmation');
    modal.setAttribute('data-delete-type', 'user');
    modal.setAttribute('data-delete-id', userId);
    
    openModal('delete-confirmation');
}


async function editAccount(accountId) {
    const modal = document.getElementById('account-modal');
    const title = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('button[type="submit"]');
    const form = modal.querySelector('form');
    
    title.textContent = 'Edit Account';
    submitBtn.textContent = 'Update Account';
    modal.setAttribute('data-mode', 'edit');
    modal.setAttribute('data-account-id', accountId);
    
    // Parent code is now auto-calculated, no dropdown needed
    
    // Load account data and populate form
    try {
        const accounts = await getAccountsFromCache();
        const account = accounts.find(acc => acc.id === accountId);
        
        if (account) {
            // Populate form fields with account data
            form.querySelector('input[name="account_code"]').value = account.account_code || '';
            form.querySelector('input[name="account_name"]').value = account.account_name || '';
            form.querySelector('input[name="opening_balance"]').value = account.opening_balance || 0;
            form.querySelector('textarea[name="description"]').value = account.account_description || '';
            
            // Set the account type dropdown
            const typeSelect = form.querySelector('select[name="account_type"]');
            if (typeSelect && account.account_type) {
                typeSelect.value = account.account_type.toLowerCase();
            }
            
            // Set the parent account dropdown
            const parentSelect = form.querySelector('select[name="parent_code"]');
            if (parentSelect && account.parent_code) {
                // Find the parent option by matching the account code
                const parentOption = Array.from(parentSelect.options).find(option => 
                    option.value === account.parent_code
                );
                if (parentOption) {
                    parentSelect.value = parentOption.value;
                }
            }
        } else {
            console.error('Account not found:', accountId);
            showNotification('Account not found', 'error');
            return;
        }
    } catch (error) {
        console.error('Failed to load account data:', error);
        showNotification('Failed to load account data', 'error');
        return;
    }
    
    openModal('account-modal');
}


async function editCheckbook(checkbookId) {
    // console.log('editCheckbook called with ID:', checkbookId);
    try {
        const response = await apiCall(`/checkbooks/${checkbookId}`);
        // console.log('Edit checkbook API response:', response);
        const checkbook = response.data;
        
        const modal = document.getElementById('checkbook-modal');
        if (!modal) {
            console.error('checkbook-modal not found for edit');
            return;
        }
        
        const title = modal.querySelector('.modal-title');
        const submitBtn = modal.querySelector('button[type="submit"]');
        const form = modal.querySelector('form');
        
        if (!title || !submitBtn || !form) {
            console.error('Edit modal elements not found:', {title, submitBtn, form});
            return;
        }
        
        title.textContent = 'Edit Checkbook';
        submitBtn.textContent = 'Update Checkbook';
        modal.setAttribute('data-mode', 'edit');
        modal.setAttribute('data-checkbook-id', checkbookId);
        
        // Fill form with existing data
        const nameField = form.querySelector('input[name="checkbook_name"]');
        const descField = form.querySelector('input[name="description"]');
        
        // console.log('Form fields found:', {nameField, descField});
        // console.log('Checkbook data to populate:', checkbook);
        
        if (nameField) nameField.value = checkbook.checkbook_name || '';
        if (descField) descField.value = checkbook.description || '';
        
        // console.log('Opening edit checkbook modal');
        openModal('checkbook-modal');
    } catch (error) {
        console.error('Failed to load checkbook for editing:', error);
        showNotification('Failed to load checkbook details', 'error');
    }
}


async function editUser(userId) {
    const modal = document.getElementById('user-modal');
    const title = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('button[type="submit"]');
    
    title.textContent = 'Edit User Password';
    submitBtn.textContent = 'Update User';
    modal.setAttribute('data-mode', 'edit');
    modal.setAttribute('data-user-id', userId);
    
    // Populate checkbook dropdown first
    await populateCheckbookDropdown();
    
    // Load user data from the users array instead of API call
    try {
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const users = usersData.data || [];
            const user = users.find(u => u.id === userId);
            
            if (user) {
                const form = modal.querySelector('form');
                form.querySelector('[name="username"]').value = user.username || '';
                form.querySelector('[name="user_role"]').value = user.user_role || 'user';
                form.querySelector('[name="checkbook_id"]').value = user.checkbook_id || '';
                // Don't populate password for security
                form.querySelector('[name="password"]').value = '';
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
    
    openModal('user-modal');
}


async function handleAccountSubmit(form, modal) {
    const formData = new FormData(form);
    const mode = modal.getAttribute('data-mode');
    const accountId = modal.getAttribute('data-account-id');
    
    // Ensure we have a checkbook ID
    if (!currentCheckbookId) {
        throw new Error('No checkbook selected. Please select a checkbook first.');
    }
    
    // Basic validation
    const accountCode = formData.get('account_code');
    const accountName = formData.get('account_name');
    const accountType = formData.get('account_type');
    const openingBalance = parseFloat(formData.get('opening_balance')) || 0;
    const description = formData.get('description') || '';
    
    // Debug form data collection
    // console.log('Form data collected:', {
    //     accountCode,
    //     accountName,
    //     accountType,
    //     openingBalance,
    //     description,
    //     currentCheckbookId
    // });
    
    if (!accountCode || !accountName || !accountType) {
        throw new Error('Please enter account code, name, and select account type');
    }
    
    // Auto-calculate parent code from first two digits + 00
    let parentCode = null;
    if (accountCode && accountCode.length >= 2) {
        const firstTwoDigits = accountCode.substring(0, 2);
        parentCode = firstTwoDigits + '00';
        // Don't set parent if it would be the same as the account code
        if (parentCode === accountCode) {
            parentCode = null;
        }
    }
    
    // Prepare account data with exact API field names
    const accountData = {
        account_code: accountCode,
        account_name: accountName,
        account_type: accountType,
        opening_balance: openingBalance,
        parent_code: parentCode,
        account_description: description,
        checkbook_id: currentCheckbookId,
        is_active: 1
    };
    
    // Debug what we're actually sending to API
    // console.log('Sending to API:', accountData);
    
    try {
        let response;
        if (mode === 'edit' && accountId) {
            // Update existing account
            response = await apiCall(`/accounts/${accountId}`, {
                method: 'PUT',
                body: accountData
            });
        } else {
            // Create new account
            response = await apiCall('/accounts', {
                method: 'POST',
                body: accountData
            });
        }
        
        // console.log('Account API response:', response);
        showNotification(`Account "${accountCode} - ${accountName}" ${mode === 'edit' ? 'updated' : 'added'} successfully`, 'success');
        
        // Invalidate account cache since account data changed
        invalidateAccountsCache(`Account ${mode === 'edit' ? 'updated' : 'created'}: ${accountName}`);
        
        closeModal(modal.id);
        
        // Refresh all relevant sections immediately
        setTimeout(() => {
            if (currentPage === 'admin') {
                updateAdminPanel();
            }
            if (currentPage === 'register') {
                updateRegisterPage();
            }
            if (currentPage === 'transactions') {
                updateTransactionsPage();
            }
            if (currentPage === 'reports') {
                updateReportsPage();
            }
        }, 300);
        
    } catch (error) {
        console.error('Failed to save account:', error);
        throw new Error(`Failed to ${mode === 'edit' ? 'update' : 'create'} account: ${error.message}`);
    }
}


async function handleCheckbookSubmit(form, modal) {
    // console.log('handleCheckbookSubmit called', {form, modal});
    const formData = new FormData(form);
    const mode = modal.getAttribute('data-mode');
    
    // console.log('Form mode:', mode);
    // console.log('Form data entries:', [...formData.entries()]);
    
    // Basic validation
    const checkbookName = formData.get('checkbook_name');
    const description = formData.get('description') || '';
    
    // console.log('Parsed form data:', {checkbookName, description});
    
    if (!checkbookName) {
        throw new Error('Please enter a checkbook name');
    }
    
    try {
        if (mode === 'add') {
            // Create new checkbook
            // console.log('Creating new checkbook...');
            const response = await apiCall('/checkbooks', {
                method: 'POST',
                body: {
                    checkbook_name: checkbookName,
                    description: description
                }
            });
            // console.log('Add response:', response);
            showNotification(`Checkbook "${checkbookName}" added successfully`, 'success');
        } else if (mode === 'edit') {
            // Update existing checkbook
            const checkbookId = modal.getAttribute('data-checkbook-id');
            // console.log('Updating checkbook ID:', checkbookId);
            const response = await apiCall(`/checkbooks/${checkbookId}`, {
                method: 'PUT',
                body: {
                    checkbook_name: checkbookName,
                    description: description
                }
            });
            // console.log('Edit response:', response);
            showNotification(`Checkbook "${checkbookName}" updated successfully`, 'success');
        }
        
        // console.log('Closing modal and refreshing...');
        closeModal(modal.id);
        // Add a small delay to ensure database update is complete before refresh
        setTimeout(() => {
            // console.log('Delayed refresh to get updated data...');
            // Force a hard refresh by clearing any potential caches
            updateAdminPanel();
        }, 1000);
    } catch (error) {
        console.error('Error in handleCheckbookSubmit:', error);
        throw new Error(`Failed to ${mode} checkbook: ${error.message}`);
    }
}


async function handleUserSubmit(form, modal) {
    const formData = new FormData(form);
    const mode = modal.getAttribute('data-mode');
    
    // Basic validation
    const username = formData.get('username');
    const checkbookId = formData.get('checkbook_id');
    const password = formData.get('password');
    const userRole = formData.get('user_role');
    
    if (!username || !checkbookId || !password || !userRole) {
        throw new Error('Please fill in all required fields');
    }
    
    if (mode === 'add') {
        // Get checkbook name from the dropdown
        const checkbookSelect = document.querySelector('#user-modal select[name="checkbook_id"]');
        const checkbookName = checkbookSelect.options[checkbookSelect.selectedIndex].text;
        
        // Generate UUID for new user
        const userId = crypto.randomUUID();
        
        // Create new user - use JSON format with all required fields
        const userData = {
            id: userId,
            username: username,
            password: password,
            user_role: userRole,
            checkbook_id: checkbookId,
            checkbook_name: checkbookName
        };
        
        console.log('Sending user data:', {
            ...userData, password: '***'
        });
        
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`Failed to create user: ${response.status}`);
        }
        
        const responseData = await response.json();
        if (responseData.status !== 'success') {
            throw new Error(responseData.message || 'Failed to create user');
        }
        
        showNotification(`User "${username}" added successfully`, 'success');
    } else if (mode === 'edit') {
        // Update existing user
        const userId = modal.getAttribute('data-user-id');
        const checkbookSelect = document.querySelector('#user-modal select[name="checkbook_id"]');
        const checkbookName = checkbookSelect.options[checkbookSelect.selectedIndex].text;
        
        const userData = {
            username: username,
            password: password,
            user_role: userRole,
            checkbook_id: checkbookId,
            checkbook_name: checkbookName
        };
        
        console.log('Updating user data:', {
            ...userData, password: '***'
        });
        
        // Use apiCall function with correct syntax
        const responseData = await apiCall(`/users/${userId}`, 'PUT', userData);
        
        showNotification(`User "${username}" updated successfully`, 'success');
    }
    
    closeModal(modal.id);
    
    // Refresh user list if we're on admin page
    if (currentPage === 'admin') {
        await updateAdminPanel();
    }
}


function importChartOfAccountsCSV() {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            await processAccountsCSVImport(text);
        } catch (error) {
            console.error('Error importing accounts CSV:', error);
            showNotification('Failed to import accounts CSV file', 'error');
        }
    };
    input.click();
}


async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Failed to load users:', error);
        return [];
    }
}


async function openAddAccountModal() {
    const modal = document.getElementById('account-modal');
    const title = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('button[type="submit"]');
    const form = modal.querySelector('form');
    
    title.textContent = 'Add New Account';
    submitBtn.textContent = 'Add Account';
    modal.setAttribute('data-mode', 'add');
    modal.removeAttribute('data-account-id');
    
    // Reset form
    form.reset();
    
    // Parent code is now auto-calculated, no dropdown needed
    
    openModal('account-modal');
}


function openAddCheckbookModal() {
    // console.log('openAddCheckbookModal called');
    const modal = document.getElementById('checkbook-modal');
    if (!modal) {
        console.error('checkbook-modal not found');
        return;
    }
    
    const title = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('button[type="submit"]');
    const form = modal.querySelector('form');
    
    if (!title || !submitBtn || !form) {
        console.error('Modal elements not found:', {title, submitBtn, form});
        return;
    }
    
    title.textContent = 'Add New Checkbook';
    submitBtn.textContent = 'Add Checkbook';
    modal.setAttribute('data-mode', 'add');
    modal.removeAttribute('data-checkbook-id');
    
    // Reset form
    form.reset();
    // console.log('Opening add checkbook modal');
    
    openModal('checkbook-modal');
}


async function openAddUserModal() {
    const modal = document.getElementById('user-modal');
    const title = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('button[type="submit"]');
    const form = modal.querySelector('form');
    
    title.textContent = 'Add New User';
    submitBtn.textContent = 'Add User';
    modal.setAttribute('data-mode', 'add');
    modal.removeAttribute('data-user-id');
    
    // Reset form completely
    form.reset();
    // Clear all field values explicitly
    form.querySelector('[name=\"username\"]').value = '';
    form.querySelector('[name=\"password\"]').value = '';
    form.querySelector('[name=\"user_role\"]').value = 'user';
    form.querySelector('[name=\"checkbook_id\"]').value = '';
    
    // Populate checkbook dropdown
    await populateCheckbookDropdown();
    
    openModal('user-modal');
}


async function populateCheckbookDropdown() {
    try {
        const response = await fetch('/api/checkbooks');
        if (!response.ok) throw new Error('Failed to fetch checkbooks');
        
        const data = await response.json();
        const checkbooks = data.data || [];
        
        const select = document.querySelector('#user-modal select[name="checkbook_id"]');
        if (select) {
            // Clear existing options except the first one
            select.innerHTML = '<option value="">Select a checkbook</option>';
            
            // Add checkbooks
            checkbooks.forEach(checkbook => {
                const option = document.createElement('option');
                option.value = checkbook.id;
                option.textContent = checkbook.checkbook_name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading checkbooks:', error);
        showNotification('Failed to load checkbooks', 'error');
    }
}


async function processAccountsCSVImport(csvText) {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must contain headers and at least one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const requiredHeaders = ['Account Code', 'Account Name', 'Account Type'];
        
        // Check if required headers exist
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each data row
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = values[index] || '';
                });

                // Validate required fields
                if (!rowData['Account Code'] || !rowData['Account Name'] || !rowData['Account Type']) {
                    errors.push(`Row ${i + 1}: Missing required fields`);
                    errorCount++;
                    continue;
                }

                // Validate account type
                const validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
                const accountType = rowData['Account Type'].toLowerCase();
                if (!validTypes.includes(accountType)) {
                    errors.push(`Row ${i + 1}: Invalid account type "${rowData['Account Type']}"`);
                    errorCount++;
                    continue;
                }

                // Prepare account data
                const accountData = {
                    account_code: rowData['Account Code'],
                    account_name: rowData['Account Name'],
                    account_type: accountType,
                    opening_balance: parseFloat(rowData['Opening Balance']) || 0,
                    parent_code: rowData['Parent Code'] || null,
                    account_description: rowData['Description'] || '',
                    checkbook_id: currentCheckbookId,
                    is_active: 1
                };

                // Create account via API
                await apiCall('/accounts', {
                    method: 'POST',
                    body: accountData
                });
                successCount++;

            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
                errorCount++;
            }
        }

        // Show results
        let message = `Import completed: ${successCount} accounts added`;
        if (errorCount > 0) {
            message += `, ${errorCount} errors`;
            console.warn('Import errors:', errors);
        }
        
        showNotification(message, errorCount > 0 ? 'warning' : 'success');
        
        // Refresh the admin panel to show new accounts
        setTimeout(() => {
            updateAdminPanel();
        }, 1000);

    } catch (error) {
        console.error('Error processing CSV:', error);
        showNotification(`CSV processing failed: ${error.message}`, 'error');
    }
}


function updateAccountsTable(accounts) {
    const tbody = document.querySelector('#admin-accounts .table tbody');
    if (!tbody) {
        console.error('Admin accounts table tbody not found');
        return;
    }

    // Ensure accounts is an array
    const accountsArray = Array.isArray(accounts) ? accounts : [];
    // console.log('Updating admin Chart of Accounts with', accountsArray.length, 'accounts');
    
    if (accountsArray.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280;">
                    ${currentCheckbookId ? 'No accounts found' : 'Please select a checkbook to view Chart of Accounts'}
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = accountsArray.map(account => `
        <tr style="${account.parent_code ? '' : 'font-weight: 600; background: #f8fafc;'}">
            <td>${account.account_code || ''}</td>
            <td>${account.parent_code ? '&nbsp;&nbsp;' : ''}${account.account_name}</td>
            <td>${account.account_type}</td>
            <td>${account.parent_code || '-'}</td>
            <td style="text-align: right;">${formatCurrency(Number(account.opening_balance || 0))}</td>
            <td>${formatCurrency((account.account_balance || 0) + (account.opening_balance || 0))}</td>
            <td><span class="badge ${account.is_active ? 'badge-success' : 'badge-warning'}">${account.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="editAccount('${account.id}')">Edit</button>
                ${account.parent_code ? `<button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteAccount('${account.id}')">Delete</button>` : ''}
            </td>
        </tr>
    `).join('');
}


async function updateAdminPanel() {
    try {
        showLoading('admin-page');
        
        // Ensure we have a valid checkbook ID for admin panel
        if (!currentCheckbookId) {
            console.warn('No checkbook selected - Admin Panel requires checkbook selection');
        }
        
        const [users, checkbooks, accounts] = await Promise.all([
            loadUsers(),
            loadCheckbooks(),
            currentCheckbookId ? apiCall(`/accounts/checkbook/${currentCheckbookId}`) : Promise.resolve({ data: [] })
        ]);

        updateUsersTable(users);
        updateCheckbooksTable(checkbooks);
        
        // Normalize accounts response to handle both array and wrapped responses
        const accountsList = Array.isArray(accounts) ? accounts : (accounts?.data ?? []);
        updateAccountsTable(accountsList);
        
        hideLoading('admin-page');
    } catch (error) {
        console.error('Failed to update admin panel:', error);
        // Show error in admin accounts table
        const tbody = document.querySelector('#admin-accounts .table tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                        Failed to load Chart of Accounts: ${error.message}
                    </td>
                </tr>
            `;
        }
        hideLoading('admin-page');
    }
}


async function updateCheckbooksTable(checkbooks) {
    // console.log('Updating checkbooks table with', checkbooks.length, 'checkbooks');
    // console.log('Full checkbooks array:', JSON.stringify(checkbooks, null, 2));
    const tbody = document.querySelector('#admin-checkbooks .table tbody');
    if (!tbody) {
        console.error('Checkbooks table tbody not found!');
        return;
    }
    
    // Display real statistics from the API
    tbody.innerHTML = checkbooks.map(checkbook => `
        <tr>
            <td>${checkbook.checkbook_name}</td>
            <td>${checkbook.user_count || 0}</td>
            <td>${checkbook.account_count || 0}</td>
            <td>${checkbook.transaction_count || 0}</td>
            <td>${formatDate(checkbook.created_at)}</td>
            <td><span class="badge ${checkbook.is_active ? 'badge-success' : 'badge-warning'}">${checkbook.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="editCheckbook('${checkbook.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteCheckbook('${checkbook.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
    
    // console.log('Checkbooks table updated successfully');
}


function updateUsersTable(users) {
    const tbody = document.querySelector('#admin-users .table-container tbody');
    if (!tbody) {
        console.error('User table tbody not found');
        return;
    }
    // console.log('Updating users table with', users.length, 'users');

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td><span class="badge ${user.user_role === 'admin' ? 'badge-danger' : 'badge-info'}">${user.user_role.charAt(0).toUpperCase() + user.user_role.slice(1)}</span></td>
            <td>${user.checkbook_name}</td>
            <td>${formatDate(user.created_at)}</td>
            <td><span class="badge badge-success">Active</span></td>
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="editUser('${user.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

        
        