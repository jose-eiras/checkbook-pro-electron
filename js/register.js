async function addTransactionFromReconcile() {
    try {
        // Store the current account ID from reconcile modal for returning
        const reconcileModal = document.getElementById('reconcile-modal');
        const accountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;
        
        closeModal('reconcile-modal');
        
        // Get account details for pre-population
        let account = null;
        if (accountId) {
            account = await loadAccountById(accountId);
        }
        
        // Use the standard openAddTransactionModal function which properly handles pre-population
        await openAddTransactionModal(accountId);
        
        // Store return navigation info AFTER the modal is opened
        const addModal = document.getElementById('add-transaction-modal');
        addModal.setAttribute('data-return-account-id', accountId);

    } catch (error) {
        console.error('Error opening add transaction modal from reconcile:', error);
        showNotification('Failed to open add transaction form', 'error');
    }
}

// Close Add Transaction modal with proper return navigation
async function closeAddTransactionModal() {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    const returnAccountId = modal.getAttribute('data-return-account-id');
    const returnSource = modal.getAttribute('data-return-source');
    
    // Clear form and attributes
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
    }
    modal.removeAttribute('data-account-id');
    modal.removeAttribute('data-return-account-id');
    modal.removeAttribute('data-return-source');
    
    closeModal('add-transaction-modal');
    await openReconcileModal(returnAccountId);
    
}

async function closeEditTransactionModal() {
    const editModal = document.getElementById('edit-transaction-modal');
    const returnAccountId = editModal ? editModal.getAttribute('data-return-account-id') : null;
    const returnSource = editModal ? editModal.getAttribute('data-return-source') : null;
    
    // Close the Edit Transaction modal
    closeModal('edit-transaction-modal');

    invalidateAccountsCache('Transacion Edited - Return to Transaction Page or Reconcile Modal');
    await loadBalances();
    if(returnSource === 'transaction-page') {
        await updateTransactionsPeriod();
    } else {
        await openReconcileModal(returnAccountId);
    }
}

async function closeReconcileModal() {
    invalidateAccountsCache('Return to Reconcile Modal');
    await loadBalances();
    await updateRegister();
    closeModal('reconcile-modal');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

async function deleteTransactionFromReconcile(transactionId) {
    try {
        const transaction = await loadTransactionById(transactionId);

        // Store the current account ID from reconcile modal for returning
        const reconcileModal = document.getElementById('reconcile-modal');
        const returnAccountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;
        
        // Check if we're in the Transaction List Modal to track source
        //const transactionListModal = document.getElementById('list-transactions-modal');
        const deleteModal = document.getElementById('delete-confirmation');
        
        // Set up delete confirmation modal for transaction
        deleteModal.setAttribute('data-delete-type', 'transaction');
        deleteModal.setAttribute('data-delete-id', transactionId);
        
        // Populate transaction details
        const detailsDiv = document.getElementById('delete-item-details');
        detailsDiv.querySelector('div:first-child').textContent = 'Transaction to delete:';
        detailsDiv.querySelector('div:last-child').innerHTML = `
            <strong>Date:</strong> ${formatDate(transaction.transaction_date)}<br>
            <strong>Amount:</strong> ${formatCurrency(Math.abs(transaction.amount))}<br>
            <strong>Description:</strong> ${transaction.description || 'No description'}
        `;
        
        // Close reconcile modal and open delete confirmation
        closeModal('reconcile-modal');
        openModal('delete-confirmation');
        await openReconcileModal(returnAccountId);

    } catch (error) {
        console.error('Error opening delete transaction modal:', error);
        showNotification('Failed to load transaction for deletion', 'error');
    }

}

async function editTransactionFromReconcile(transactionId) {
    try {
        const transaction = await loadTransactionById(transactionId);
        
        // Store the account ID from reconcile modal for returning
        const reconcileModal = document.getElementById('reconcile-modal');
        const accountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;
        
        // Close reconcile modal first
        closeModal('reconcile-modal');
        
        // Store account ID and source in Edit modal for return navigation
        const editModal = document.getElementById('edit-transaction-modal');
        if (editModal) {
            if (accountId) {
                editModal.setAttribute('data-return-account-id', accountId);
            }
            editModal.setAttribute('data-return-source', 'reconcile-modal');
        }
        
        await populateEditTransactionModal(transaction);
        openModal('edit-transaction-modal');
    } catch (error) {
        console.error('Error opening edit transaction modal from reconcile:', error);
        showNotification('Failed to load transaction for editing', 'error');
    }
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    // Handle date string directly to avoid timezone conversion issues
    // Database dates are stored as YYYY-MM-DD strings
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Extract just the date part (YYYY-MM-DD) in case there's time data
        return dateString.substring(0, 10);
    }
    
    // Fallback for other date formats - use UTC methods to avoid timezone shifts
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Ultra-fast account lookups using cache
function getAccountById(accountId) {
    return accountsMap[accountId] || null;
}

async function getAccountNameById(accountId) {
    const account = getAccountById(accountId);
    if (account) {
        return account.account_name;
    }
    
    // Fallback: load from cache if not found
    await getAccountsFromCache();
    const accountAfterLoad = getAccountById(accountId);
    return accountAfterLoad ? accountAfterLoad.account_name : 'Unknown Account';
}

async function handleAddTransactionSubmit(form) {
    const formData = new FormData(form);
    const modal = form.closest('.modal-overlay');
    const accountId = modal.getAttribute('data-account-id');
    
    const transactionData = {
        transaction_date: formData.get('date'),
        description: formData.get('description') || '', // Store blank instead of null
        amount: parseFloat(formData.get('amount')),
        transaction_type: formData.get('transaction_type'),
        from_account_id: formData.get('fromAccount') || accountId, // Use selected fromAccount or fallback to preset account
        to_account_id: formData.get('toAccount'),
        reference_number: formData.get('referenceNumber') || '', // Store blank instead of null
        checkbook_id: currentCheckbookId
    };
    
    
    // Validation
    if (!transactionData.transaction_date) {
        throw new Error('Transaction date is required');
    }
    preservedDate = transactionData.transaction_date;
    // Get the selected account to check if it's "Other"
    const accounts = await getAccountsFromCache();
    const toAccount = accounts.find(acc => acc.id === transactionData.to_account_id);
    const isOtherAccount = toAccount && (toAccount.account_name.toLowerCase().includes('other') || toAccount.account_code === 'OTHER');
    
    // Only require description if the "To Account" indicates "Other"
    if (isOtherAccount && !transactionData.description) {
        throw new Error('Transaction description is required when using "Other" account');
    }
    if (!transactionData.amount || isNaN(transactionData.amount) || transactionData.amount <= 0) {
        throw new Error('Valid transaction amount is required (must be greater than 0)');
    }
    if (!transactionData.transaction_type) {
        throw new Error('Transaction type is required');
    }
    if (!transactionData.from_account_id) {
        throw new Error('From account is required - please select an account');
    }
    if (!transactionData.to_account_id) {
        throw new Error('To account is required');
    }
    if (!transactionData.checkbook_id) {
        throw new Error('Checkbook ID is required');
    }
    
    const response = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to create transaction: ${response.status} - ${errorText}`);
    }
    
    showNotification('Transaction added successfully', 'success');

}

async function handleDeleteConfirmation() {
    const modal = document.getElementById('delete-confirmation');
    const deleteType = modal.getAttribute('data-delete-type');
    const deleteId = modal.getAttribute('data-delete-id');
    
    if (!deleteType || !deleteId) {
        showNotification('Delete operation failed - missing information', 'error');
        closeModal('delete-confirmation');
        return;
    }
    
    // Handle different delete types
    if (deleteType === 'transaction') {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${deleteId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete transaction');
            }
            
            showNotification('Transaction deleted successfully', 'success');
            
            closeModal('delete-confirmation');

            // Store the account ID from reconcile modal for returning
            const reconcileModal = document.getElementById('reconcile-modal');
            const returnAccountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;

            await openReconcileModal(returnAccountId);

        } catch (error) {
            console.error('Error deleting transaction:', error);
            showNotification('Failed to delete transaction', 'error');
        }
    } else if (deleteType === 'user') {
        try {
            const response = await fetch(`/api/users/${deleteId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showNotification('User deleted successfully', 'success');
                // Refresh user list if we're on admin page
                if (currentPage === 'admin') {
                    await updateAdminPanel();
                }
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('Failed to delete user', 'error');
        }
    } else if (deleteType === 'checkbook') {
        try {
            console.log('Deleting checkbook with ID:', deleteId);
            const response = await apiCall(`/checkbooks/${deleteId}`, 'DELETE');
            // console.log('Delete API response:', response);
            showNotification('Checkbook deleted successfully', 'success');
            
            // Refresh admin panel if we're on admin page
            if (currentPage === 'admin') {
                setTimeout(() => {
                    updateAdminPanel();
                }, 500);
            }
        } catch (error) {
            console.error('Error deleting checkbook:', error);
            showNotification('Failed to delete checkbook', 'error');
        }
    } else if (deleteType === 'account') {
        try {
            // console.log('Deleting account with ID:', deleteId);
            const response = await apiCall(`/accounts/${deleteId}`, 'DELETE');
            
            // Invalidate account cache since account was deleted
            invalidateAccountsCache('Account deleted');
            
            showNotification('Account deleted successfully', 'success');
            
            // Refresh admin panel if we're on admin page
            if (currentPage === 'admin') {
                setTimeout(() => {
                    updateAdminPanel();
                }, 500);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showNotification('Failed to delete account', 'error');
        }
    } else {
        // For other types, show not implemented message
        showNotification(`${deleteType} deletion not implemented yet`, 'info');
    }
    
    closeModal('delete-confirmation');
}

async function handleEditTransactionSubmit(form) {
    const formData = new FormData(form);
    const modal = form.closest('.modal-overlay');
    const transactionId = modal.getAttribute('data-transaction-id');
    
    if (!transactionId) {
        throw new Error('Transaction ID not found');
    }
    
    // Debug: Check what form data we're getting
    // console.log('Edit form data:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }
    
    const transactionData = {
        transaction_date: formData.get('date'),
        description: formData.get('description') || '', // Store blank instead of null
        amount: parseFloat(formData.get('amount')),
        transaction_type: formData.get('transaction_type'),
        from_account_id: formData.get('fromAccount'),
        to_account_id: formData.get('toAccount'),
        reference_number: formData.get('referenceNumber') || '' // Store blank instead of null
    };
    
    // console.log('Transaction data being sent:', transactionData);
    
    // Validate required fields before sending
    if (!transactionData.transaction_type) {
        throw new Error('Transaction type is required - please select Debit or Credit');
    }
    if (!transactionData.transaction_date) {
        throw new Error('Transaction date is required');
    }
    if (!transactionData.from_account_id) {
        throw new Error('From account is required');
    }
    if (!transactionData.amount || isNaN(transactionData.amount) || transactionData.amount <= 0) {
        throw new Error('Valid amount is required');
    }
    
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to update transaction');
    }
    
    showNotification('Transaction updated successfully', 'success');
    
}

async function handleReconcileSubmit(form) {
    
    // Validate required fields first
    const formData = new FormData(form);
    const statementDate = formData.get('statementDate');
    const statementBalance = formData.get('statementBalance');
    
    if (!statementDate) {
        showNotification('Statement date is required', 'error');
        return;
    }
    
    if (!statementBalance || isNaN(parseFloat(statementBalance))) {
        showNotification('Valid statement balance is required', 'error');
        return;
    }
    
    // Get checked transactions
    const modal = form.closest('.modal-overlay');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked:not(#toggle-mark-unmark)');
    const transactionIds = Array.from(checkboxes)
        .map(cb => cb.getAttribute('data-transaction-id'))
        .filter(id => id); // Remove any null/undefined values
    
    
    if (transactionIds.length === 0) {
        showNotification('No transactions selected for reconciliation', 'warning');
        return;
    }
    
    // Verify reconciliation is balanced before proceeding
    const differenceEl = document.getElementById('reconcile-difference');
    const differenceText = differenceEl?.textContent || '$0.00';
    const difference = Math.abs(parseFloat(differenceText.replace(/[$,]/g, '')));
    
    if (difference >= 0.01) {
        showNotification('Cannot complete reconciliation - accounts are not balanced', 'error');
        return;
    }
    
    try {
        // Get form data for reconciliation record
        const accountId = modal.getAttribute('data-account-id');
        const statementBalance = parseFloat(formData.get('statementBalance') || 0);
        const statementDate = formData.get('statementDate');
        
        // Calculate totals from selected transactions
        let totalDebits = 0;
        let totalCredits = 0;
        checkboxes.forEach(checkbox => {
            const amount = Math.abs(parseFloat(checkbox.dataset.amount) || 0);
            if (checkbox.dataset.type === 'credit') {
                totalCredits += amount;
            } else {
                totalDebits += amount;
            }
        });
        
        // Create reconciliation record matching the database schema exactly
        const reconciliationData = {
            checkbook_id: currentCheckbookId,
            account_id: accountId,
            statement_date: statementDate,
            statement_balance: parseFloat(statementBalance),
            reconciled_balance: parseFloat(statementBalance),
            difference: 0.0 // Should be 0 when reconciliation is complete
        };
        
        // Mark transactions as reconciled first (this is the most important part)
        const transactionPromises = await Promise.all(
            transactionIds.map(id => 
                fetch(`${API_BASE_URL}/transactions/${id}/reconcile`, {
                    method: 'PUT'
                })
            )
        );
        
        // Check if any transaction reconciliation failed
        const failedTransactions = transactionPromises.filter(response => !response.ok);
        if (failedTransactions.length > 0) {
            throw new Error(`Failed to reconcile ${failedTransactions.length} transactions`);
        }
        
        // Save reconciliation record (essential for history tracking)
        const reconcileResponse = await fetch(`${API_BASE_URL}/reconciliations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reconciliationData)
        });
        
        if (!reconcileResponse.ok) {
            const errorDetails = await reconcileResponse.text();
            console.error('Failed to save reconciliation record:', errorDetails);
            
            // Still show warning but don't fail since transactions were reconciled
            showNotification('Transactions reconciled, but could not save reconciliation record.', 'warning');
        }
        
        showNotification(`Reconciliation completed successfully! ${transactionIds.length} transactions reconciled.`, 'success');
        
        // Refresh dashboard and assets/liabilities after reconciliation
        invalidateAccountsCache('Return to Reconcile Modal');
        await updateDashboard();
        if (currentPage === 'register') {
            await updateRegister();
        }
        
    } catch (error) {
        console.error('Reconciliation error:', error);
        showNotification(error.message || 'Failed to complete reconciliation', 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const modal = form.closest('.modal-overlay');
    const submitter = event.submitter; // Get which button was clicked
    
    if (modal) {
        try {
            // Handle different modal types
            if (modal.id === 'add-transaction-modal') {
                await handleAddTransactionSubmit(form);
                
                form.reset();
                // Set today's date as default
                const dateField = form.querySelector('[name="date"]');
                if (dateField) {
                    if (preservedDate) {
                        dateField.value = preservedDate;
                    } else {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        dateField.value = `${year}-${month}-${day}`;
                    }
                }
                
                // Refresh the account balance in the modal if there's a preset account
                const accountId = modal.getAttribute('data-account-id');
                if (accountId) {
                    try {
                        const account = await loadAccountById(accountId);
                        if (account && account.data) {
                            // Update the balance display in the modal
                            const infoItems = modal.querySelectorAll('#from-account-info .info-item');
                            if (infoItems.length >= 2) {
                                const balanceValue = infoItems[1].querySelector('.info-value');
                                if (balanceValue) {
                                    const currentBalance = (account.data.account_balance || 0) + (account.data.opening_balance || 0);
                                    const formattedBalance = formatCurrency(currentBalance);
                                    balanceValue.textContent = formattedBalance;
                                    balanceValue.style.color = currentBalance >= 0 ? 'var(--banking-green)' : 'var(--banking-red)';
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error refreshing account balance:', error);
                    }
                }
                
                // Keep modal open, don't close it
                showNotification('Transaction added! Add another transaction.', 'success');

            } else if (modal.id === 'statement-modal') {
                await handleStatementSubmit((form));
                closeModal('statement-modal');
            } else if (modal.id === 'edit-transaction-modal') {
                await handleEditTransactionSubmit(form);
                closeEditTransactionModal();
            } else if (modal.id === 'reconcile-modal') {
                await handleReconcileSubmit(form);
                closeModal(modal.id);
            } else {
                // Handle admin forms
                if (modal.id === 'user-modal') {
                    await handleUserSubmit(form, modal);
                } else if (modal.id === 'checkbook-modal') {
                    await handleCheckbookSubmit(form, modal);
                } else if (modal.id === 'account-modal') {
                    await handleAccountSubmit(form, modal);
                } else {
                    // Unhandled form - do not show fake success
                    console.warn('Unhandled form submission for modal:', modal.id);
                    closeModal(modal.id);
                }
            }
            
        } catch (error) {
            console.error('Error submitting form:', error);
            showNotification(error.message || 'Failed to submit form', 'error');
        }
    }
}

async function loadAccountById(accountId) {
    try {
        const response = await apiCall(`/accounts/${accountId}`);
        // Server returns the object directly, not wrapped in data property
        return response;
    } catch (error) {
        console.error('Failed to load account:', error);
        throw error;
    }
}

async function loadReconciliationsByAccount(accountId) {
    try {
        const response = await apiCall(`/reconciliations/account/${accountId}`);
        return response.data || [];
    } catch (error) {
        console.error('Failed to load reconciliation history:', error);
        return [];
    }
}

async function loadTransactionById(transactionId) {
    try {
        const response = await apiCall(`/transactions/${transactionId}`);
        return response.data;
    } catch (error) {
        console.error('Failed to load transaction:', error);
        throw error;
    }
} 

async function loadTransactionsByAccount(accountId) {
    try {
        const response = await apiCall(`/transactions/account/${accountId}`);
        // Server returns the array directly, not wrapped in data property
        const transactions = Array.isArray(response) ? response : (response.data || []);
        return transactions;
    } catch (error) {
        console.error('Failed to load account transactions:', error);
        return [];
    }
}

function markAllCleared() {
    const checkboxes = document.querySelectorAll('#reconcile-modal input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateReconcileBalance();
}

async function openAddTransactionModal(accountId = null) {
    try {
        let account = null;
        if (accountId) {
            account = await loadAccountById(accountId);
        }
        await populateAddTransactionModal(account, !!accountId);
        openModal('add-transaction-modal');
    } catch (error) {
        console.error('Error loading account for transaction modal:', error);
        showNotification('Failed to load account details', 'error');
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

async function openReconcileModal(accountId) {
    try {
        // Force reload of fresh data
        const [account, transactions] = await Promise.all([
            loadAccountById(accountId),
            loadTransactionsByAccount(accountId)
        ]);
        
        // Store account ID in modal for return navigation
        const reconcileModal = document.getElementById('reconcile-modal');
        if (reconcileModal) {
            reconcileModal.setAttribute('data-account-id', accountId);
        }
        
        populateReconcileModal(account, transactions);
        openModal('reconcile-modal');
    } catch (error) {
        console.error('Error loading data for reconcile modal:', error);
        showNotification('Failed to load reconciliation data', 'error');
    }
}

async function populateAccountSelects(container) {
    try {
        const accounts = await getAccountsFromCache();
        const selects = container.querySelectorAll('select');

        const typeOrder = { 'income': 1, 'expense': 2, 'liability': 3, 'asset': 4, 'equity': 5 };
        
        // Define the color mapping for parent entries
        const typeColors = {
            'expense': 'red',
            'income': 'green',
            'liability': 'blue',
            'asset': 'blue',
            'equity': 'blue'
        };

        selects.forEach(select => {
            if (select.name === 'fromAccount' || select.name === 'toAccount' || select.classList.contains('account-select')) {
        
                const accountsArray = Array.isArray(accounts) ? accounts : [];

                const sortedAccounts = accountsArray.sort((a, b) => {
                    const typeA = typeOrder[a.account_type] || 99;
                    const typeB = typeOrder[b.account_type] || 99;
                    
                    if (typeA !== typeB) return typeA - typeB;
                    return (a.account_code || '').localeCompare(b.account_code || '');
                });

                select.innerHTML = '<option value="">Select Account</option>' + sortedAccounts.map(account => {
                    const isParent = !account.parent_code;
                    
                    if (isParent) {
                        // Determine the color based on the account type
                        const textColor = typeColors[account.account_type?.toLowerCase()] || 'black';

                        return `<option value="" disabled style="font-weight: bold; color: ${textColor}; background-color: #f8fafc;">
                                    ${account.account_name.toUpperCase()} (${account.account_type})
                                </option>`;
                    } else {
                        return `<option value="${account.id}">
                                    &nbsp;&nbsp;&nbsp;&nbsp;${account.account_name} [${account.account_code}]
                                </option>`;
                    }
                }).join('');
            }
        });
    } catch (error) {
        console.error('Failed to populate account selects:', error);
    }
}

// Modal population functions
let preservedDate = null;
async function populateAddTransactionModal(account, hasPresetAccount = false) {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) {
        console.error('Add transaction modal not found');
        return;
    }
    
    const form = modal.querySelector('form');
    const dateField = form ? form.querySelector('[name="date"]') : null;

    if (form) {
        form.reset();
        
        // Re-apply the preserved date if it exists, otherwise set to today
        if (dateField) {
            if (preservedDate) {
                dateField.value = preservedDate;
                console.log('Date Field Value', dateField.value);
            } else {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                dateField.value = `${year}-${month}-${day}`;
            }
        }
    }
    
    modal.removeAttribute('data-account-id');
    modal.removeAttribute('data-return-account-id');
    modal.removeAttribute('data-return-source');
    
    const fromAccountInfo = modal.querySelector('#from-account-info');
    const fromAccountSelector = modal.querySelector('#from-account-selector');
    const accountData = account.data;
    
    fromAccountInfo.style.display = 'block';
    fromAccountSelector.style.display = 'none';
    
    const infoValues = fromAccountInfo.querySelectorAll('.info-value');
    if (infoValues[0]) infoValues[0].textContent = accountData.account_name || 'Unknown Account';
    if (infoValues[1]) {
        infoValues[1].textContent = formatCurrency((accountData.account_balance || 0) + (accountData.opening_balance || 0));
    }
    
    modal.setAttribute('data-account-id', accountData.id);
    
    await populateAccountSelects(modal);
}

function populateDeleteTransactionModal(transaction) {
    if (!transaction) return;
    console.log('Transaction to delete: ', transaction);
    
    const modal = document.getElementById('delete-transaction-modal');
    if (modal) {
        // Update transaction details in delete confirmation
        const detailsContainer = modal.querySelector('.transaction-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="alert alert-warning" style="margin-bottom: 1rem; padding: 1rem; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <svg style="width: 20px; height: 20px; color: #f59e0b;" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <span style="font-weight: 600; color: #92400e;">Warning: This action cannot be undone</span>
                    </div>
                    <p style="color: #92400e; margin: 0; font-size: 0.875rem;">Deleting this transaction will permanently remove it from your records.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #374151; font-size: 1rem; font-weight: 600;">Transaction Details:</h4>
                    <div style="display: grid; gap: 0.5rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280; font-weight: 500;">Date:</span>
                            <span style="color: #374151; font-weight: 600;">${formatDate(transaction.transaction_date)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280; font-weight: 500;">Description:</span>
                            <span style="color: #374151; font-weight: 600;">${transaction.description || ''}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280; font-weight: 500;">Amount:</span>
                            <span style="color: #dc2626; font-weight: 700; font-size: 1.1rem;">${formatCurrency(Math.abs(transaction.amount))}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280; font-weight: 500;">From Account:</span>
                            <span style="color: #374151; font-weight: 600;">${transaction.from_account_name || getAccountName(transaction.from_account_id) || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280; font-weight: 500;">To Account:</span>
                            <span style="color: #374151; font-weight: 600;">${transaction.to_account_name || getAccountName(transaction.to_account_id) || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Store transaction ID for deletion
        modal.setAttribute('data-transaction-id', transaction.id);
    }
}

async function populateEditTransactionModal(transaction) {
    if (!transaction) return;
    
    const modal = document.getElementById('edit-transaction-modal');
    if (modal) {
        // Update the info card with from account name only
        const infoValue = modal.querySelector('.info-value');
        
        // Get from account name
        const fromAccountName = await getAccountNameById(transaction.from_account_id);
        
        if (infoValue) {
            infoValue.textContent = fromAccountName || 'Unknown Account';
        }
        
        // Set the radio buttons for transaction type
        const debitRadio = modal.querySelector('#debit-edit');
        const creditRadio = modal.querySelector('#credit-edit');
        if (transaction.transaction_type === 'debit') {
            if (debitRadio) debitRadio.checked = true;
            if (creditRadio) creditRadio.checked = false;
        } else {
            if (creditRadio) creditRadio.checked = true;
            if (debitRadio) debitRadio.checked = false;
        }
        
        // First populate account selects with real data
        await populateAccountSelects(modal);
        
        // Then populate form fields with transaction data
        const form = modal.querySelector('form');
        if (form) {
            const fields = {
                'date': formatDateForInput(transaction.transaction_date),
                'description': transaction.description || '',
                'amount': Math.abs(transaction.amount).toString(),
                'toAccount': transaction.to_account_id,
                'referenceNumber': transaction.reference_number || ''
            };
            
            // Set the hidden fromAccount field
            const fromAccountField = modal.querySelector('#edit-from-account-id');
            if (fromAccountField) {
                fromAccountField.value = transaction.from_account_id;
            }
            
            Object.entries(fields).forEach(([name, value]) => {
                const field = form.querySelector(`[name="${name}"]`);
                if (field) {
                    field.value = value;
                }
            });
            
            // Store transaction ID for form submission
            modal.setAttribute('data-transaction-id', transaction.id);
        }
    }
}

async function populateReconcileModal(account, transactions) {
    if (!account) return;
    
    // Store account data globally for calculations
    window.currentReconcileAccount = account;
    
    // Handle both wrapped and unwrapped account objects
    const accountData = account.data || account;
    
    const modal = document.getElementById('reconcile-modal');
    if (!modal) {
        console.error('Reconcile modal not found');
        return;
    }
    
    try {
        // Update account details
        const infoItems = modal.querySelectorAll('.info-value');
        const pendingTransactions = transactions.filter(t => !t.is_reconciled);
        
        if (infoItems[0]) infoItems[0].textContent = accountData.account_name || 'Unknown Account';
        if (infoItems[1]) infoItems[1].textContent = formatCurrency((accountData.account_balance || 0) + (accountData.opening_balance || 0));
        if (infoItems[2]) infoItems[2].textContent = pendingTransactions.length.toString();
        
        // Update status badge
        const statusBadge = modal.querySelector('.badge');
        if (statusBadge) {
            if (pendingTransactions.length === 0) {
                statusBadge.textContent = 'Balanced';
                statusBadge.className = 'badge badge-success';
            } else {
                statusBadge.textContent = 'Unbalanced';
                statusBadge.className = 'badge badge-warning';
            }
        }
        
        // Load and update last reconciliation info with real data
        try {
            const accountId = accountData.id;
            const reconciliations = await loadReconciliationsByAccount(accountId);
            
            // Find the most recent reconciliation by comparing dates
            let lastReconciliation = null;
            if (reconciliations.length > 0) {
                lastReconciliation = reconciliations.reduce((latest, current) => {
                    const latestDate = new Date(latest.statement_date);
                    const currentDate = new Date(current.statement_date);
                    return currentDate > latestDate ? current : latest;
                });
            }
            
            // Target the specific last reconciliation elements directly by ID
            const lastStatementDateEl = modal.querySelector('#last-statement-Date');
            const lastStatementBalanceEl = modal.querySelector('#liabilities-section'); // This is misnamed but that's the actual ID
            
            if (lastReconciliation) {
                const formattedDate = formatDate(lastReconciliation.statement_date);
                const formattedBalance = formatCurrency(lastReconciliation.statement_balance);
                
                if (lastStatementDateEl) lastStatementDateEl.textContent = formattedDate;
                if (lastStatementBalanceEl) lastStatementBalanceEl.textContent = formattedBalance;
                
                // Pre-populate the new statement balance field with the last statement balance
                const statementBalanceInput = modal.querySelector('[name="statementBalance"]');
                if (statementBalanceInput) {
                    statementBalanceInput.value = lastReconciliation.statement_balance.toFixed(2);
                }
            } else {
                if (lastStatementDateEl) lastStatementDateEl.textContent = 'No last statement';
                if (lastStatementBalanceEl) lastStatementBalanceEl.textContent = '$0.00';
                
                // For first reconciliation, start with current account balance
                const statementBalanceInput = modal.querySelector('[name="statementBalance"]');
                if (statementBalanceInput) {
                    const currentBalance = (accountData.account_balance || 0) + (accountData.opening_balance || 0);
                    statementBalanceInput.value = currentBalance.toFixed(2);
                }
            }
        } catch (error) {
            console.error('Error loading reconciliation history:', error);
            // Fall back to placeholder text if loading fails
            const lastStatementDateEl = modal.querySelector('#last-statement-Date');
            const lastStatementBalanceEl = modal.querySelector('#liabilities-section');
            if (lastStatementDateEl) lastStatementDateEl.textContent = 'Unable to load history';
            if (lastStatementBalanceEl) lastStatementBalanceEl.textContent = '$0.00';
        }
        
        // Clear form fields
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            // Set today's date as default
            const dateField = form.querySelector('[name="statementDate"]');
            if (dateField) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                dateField.value = `${year}-${month}-${day}`;
            }
        }
        
        // Update transaction table for reconciliation
        const tbody = modal.querySelector('.table tbody');
        if (tbody) {
            if (pendingTransactions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: #6b7280;">
                            All transactions have been reconciled
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = pendingTransactions.map(transaction => `
                    <tr>
                        <td>
                            <input type="checkbox" class="checkbox" onchange="updateReconcileBalance()" data-transaction-id="${transaction.id}" data-amount="${transaction.amount}" data-type="${transaction.transaction_type}">
                        </td>
                        <td>${formatDate(transaction.transaction_date)}</td>
                        <td>${transaction.to_account_name || getAccountName(transaction.to_account_id) || 'Unknown'}</td>
                        <td>${transaction.reference_number || '-'}</td>
                        <td style="color: ${transaction.transaction_type === 'credit' ? 'var(--banking-green)' : 'var(--banking-red)'};">
                            ${transaction.transaction_type === 'credit' ? '+' : '-'}${formatCurrency(Math.abs(transaction.amount))}
                        </td>
                        <td><span class="badge badge-warning">Pending</span></td>
                        <td style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="editTransactionFromReconcile('${transaction.id}')">Edit</button>
                            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteTransactionFromReconcile('${transaction.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
        
        // Set up event listener for statement balance input
        const statementBalanceInput = modal.querySelector('[name="statementBalance"]');
        if (statementBalanceInput) {
            // Remove any existing listeners
            statementBalanceInput.removeEventListener('input', updateReconcileBalance);
            // Add new listener
            statementBalanceInput.addEventListener('input', updateReconcileBalance);
        }
        
        // Update balance summary
        updateReconcileBalanceSummary(account, []);
    } catch (error) {
        console.error('Error populating reconcile modal:', error);
    }
}
        
function setActiveNavItem(element) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    // Add active class to clicked item
    element.classList.add('active');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Toggle all transactions in reconcile modal
function toggleAllTransactions(toggleCheckbox) {
    const checkboxes = document.querySelectorAll('#reconcile-modal input[type="checkbox"]:not(#toggle-mark-unmark)');
    checkboxes.forEach(checkbox => {
        checkbox.checked = toggleCheckbox.checked;
    });
    updateReconcileBalance();
}

function unmarkAll() {
    const checkboxes = document.querySelectorAll('#reconcile-modal input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateReconcileBalance();
}

function updateAccountCards(type, accounts) {
    // Filter out parent accounts - only show leaf accounts for data entry
    const leafAccounts = accounts.filter(account => {
        // Check if this account has children
        const hasChildren = accounts.some(otherAccount => 
            otherAccount.parent_code === account.account_code
        );
        // Only show accounts that don't have children (leaf accounts)
        return !hasChildren;
    });
    
    const assetsContainer = document.querySelector(`#register-page .assets-section .account-grid`);
    const liabilitiesContainer = document.querySelector(`#register-page .liabilities-section .account-grid`);
    
    if (type === 'assets' && assetsContainer) {
        assetsContainer.innerHTML = leafAccounts.map(account => `
            <div class="account-card">                       
                <div class="account-info table-div-container">
                    <div class="table-div-row">
                        <div style="width: 10%; font-size: 28px;" class="account-icon table-div-cell">${getAccountIcon(account.account_name, account.account_type)}</div>
                        <div style="width: 45%;" class="account-name table-div-cell">${account.account_name}</div>
                        <div class="account-balance-amount table-div-cell" style="width: 30%; text-align:right; color: var(--banking-green); font-weight: 600;">
                            ${formatCurrency((account.account_balance || 0) + (account.opening_balance || 0))}
                        </div>
                        <button style="width:80%; background-color: transparent" class="btn" onclick="openReconcileModal('${account.id}')" title="Add Transactions & Reconcile"><img src="images/document-check.svg" /></button>
                    </div>
                    
                </div>
            </div>
        `).join('');
    }
    
    if (type === 'liabilities' && liabilitiesContainer) {
        liabilitiesContainer.innerHTML = leafAccounts.map(account => `
            <div class="account-card">
                <div class="account-info table-div-container">
                    <div class="table-div-row">
                        <div style="width: 10%; font-size: 28px;" class="account-icon table-div-cell">${getAccountIcon(account.account_name, account.account_type)}</div>
                        <div style="width: 45%;" class="account-name table-div-cell">${account.account_name}</div>
                        <div class="account-balance-amount table-div-cell" style="width:30%; text-align:right; color: var(--banking-red); font-weight: 600;">
                            ${formatCurrency(Math.abs((account.account_balance || 0) + (account.opening_balance || 0)))}
                        </div>
                        <button style="width:80%; background-color: transparent" class="btn" onclick="openReconcileModal('${account.id}')" title="Add Transactions & Reconcile"><img src="images/document-check.svg" /></button>                              
                    </div>
                    
                </div>
            </div>
        `).join('');
    }
}

async function updateRegister() {
    if (!currentCheckbookId) return;

    try {
        showLoading('register-page');
        
        const accounts = await getAccountsFromCache();

        const assets = accounts.filter(acc => acc.account_type === 'asset');
        const liabilities = accounts.filter(acc => acc.account_type === 'liability');

        updateAccountCards('assets', assets);
        updateAccountCards('liabilities', liabilities);
        
        hideLoading('register-page');
    } catch (error) {
        console.error('Failed to update assets/liabilities:', error);
        hideLoading('register-page');
    }
}

function updateReconcileBalance() {
    // Get all checked transactions
    const checkboxes = document.querySelectorAll('#reconcile-modal input[type="checkbox"]:checked');
    const clearedTransactions = Array.from(checkboxes).map(checkbox => ({
        id: checkbox.dataset.transactionId,
        amount: checkbox.dataset.amount,
        transaction_type: checkbox.dataset.type
    }));
    
    // Get current account info from the modal's stored data
    const modal = document.getElementById('reconcile-modal');
    const accountId = modal?.getAttribute('data-account-id');
    
    // Find the account data (this should be stored in a global variable when modal opens)
    let currentBalance = 0;
    if (window.currentReconcileAccount) {
        const accountData = window.currentReconcileAccount.data || window.currentReconcileAccount;
        currentBalance = (accountData.account_balance || 0) + (accountData.opening_balance || 0);
    } else {
        // Fallback: try to get from the displayed current balance
        const currentBalanceEl = document.querySelector('#reconcile-modal .info-value[style*="font-size: 1.125rem"]');
        if (currentBalanceEl) {
            currentBalance = parseFloat(currentBalanceEl.textContent.replace(/[$,]/g, ''));
        }
    }
    
    updateReconcileBalanceSummary({ account_balance: currentBalance, opening_balance: 0 }, clearedTransactions);
}

function updateReconcileBalanceSummary(account, clearedTransactions = []) {
    // Handle both wrapped and unwrapped account objects
    const accountData = account.data || account;
    const currentBalance = (accountData.account_balance || 0) + (accountData.opening_balance || 0);
    
    // Calculate debits and credits from selected transactions
    let totalDebits = 0;
    let totalCredits = 0;
    
    clearedTransactions.forEach(transaction => {
        const amount = Math.abs(parseFloat(transaction.amount) || 0);
        if (transaction.transaction_type === 'credit') {
            totalCredits += amount;
        } else {
            totalDebits += amount;
        }
    });
    
    // Get new statement balance from form
    const statementBalanceInput = document.querySelector('[name="statementBalance"]');
    const newStatementBalance = parseFloat(statementBalanceInput?.value || 0);
    
    // Get last statement balance from the reconciliation history
    const lastStatementBalanceEl = document.querySelector('#liabilities-section');
    const lastStatementBalanceText = lastStatementBalanceEl?.textContent || '$0.00';
    const lastStatementBalance = parseFloat(lastStatementBalanceText.replace(/[$,]/g, ''));
    
    // Correct reconciliation formula: Last Statement Balance + Credits - Debits should equal New Statement Balance
    // Difference = (Last Statement Balance + Credits - Debits) - New Statement Balance
    const calculatedBalance = lastStatementBalance + totalCredits - totalDebits;
    const difference = calculatedBalance - newStatementBalance;
    
    // Update summary cards
    const debitsEl = document.getElementById('reconcile-debits');
    const creditsEl = document.getElementById('reconcile-credits');
    const differenceEl = document.getElementById('reconcile-difference');
    
    if (debitsEl) debitsEl.textContent = formatCurrency(totalDebits);
    if (creditsEl) creditsEl.textContent = formatCurrency(totalCredits);
    if (differenceEl) {
        differenceEl.textContent = formatCurrency(Math.abs(difference));
        // Color coding for difference
        if (Math.abs(difference) < 0.01) { // Essentially zero (accounting for floating point precision)
            differenceEl.style.color = 'var(--banking-green)';
        } else {
            differenceEl.style.color = 'var(--banking-red)';
        }
    }
    
    // Enable/disable Complete Reconciliation button based on difference
    const completeButton = document.querySelector('#reconcile-modal .btn-success');
    if (completeButton) {
        const isBalanced = Math.abs(difference) < 0.01;
        completeButton.disabled = !isBalanced;
        completeButton.style.opacity = isBalanced ? '1' : '0.6';
        completeButton.style.cursor = isBalanced ? 'pointer' : 'not-allowed';
        completeButton.style.backgroundColor = isBalanced ? '' : '#6b7280';
        
        if (isBalanced) {
            completeButton.textContent = 'Complete Reconciliation';
        } else {
            completeButton.textContent = `Complete Reconciliation (Off by ${formatCurrency(Math.abs(difference))})`;
        }
    }
}

async function addStatement() {
    try {
        // Store the current account ID from reconcile modal for returning
        const modal = document.getElementById('statement-modal');
        const reconcileModal = document.getElementById('reconcile-modal');
        const returnAccountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;
        
        closeModal('reconcile-modal');

        // Clear form fields
        const form = modal.querySelector('form');
        console.log('Form:', form);
        if (form) {
            form.reset();
            // Set today's date as default
            const dateField = form.querySelector('[name="statement_date"]');
            console.log('Date field:', dateField);
            if (dateField) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                dateField.value = `${year}-${month}-${day}`;
            }
        }

        openModal('statement-modal');

    } catch (error) {
        console.error('Error opening add transaction modal from reconcile:', error);
        showNotification('Failed to open add transaction form', 'error');
    }
}


async function handleStatementSubmit(form) {

    console.log('handleStatementSubmit called');

    const formData = new FormData(form);
    const modal = form.closest('.modal-overlay');
    const reconcileModal = document.getElementById('reconcile-modal');
    const accountId = reconcileModal ? reconcileModal.getAttribute('data-account-id') : null;

    // Create reconciliation record matching the database schema exactly
    const statementData = {
        checkbook_id: currentCheckbookId,
        account_id: accountId,
        statement_date: formData.get('statement_date'),
        statement_balance: parseFloat(formData.get('statement_balance')),
        reconciled_balance: parseFloat(formData.get('statement_balance')),
        difference: 0.0 // Should be 0 when reconciliation is complete
    };
    console.log('Statement data to save:', statementData);
    
    // Validation
    if (!statementData.statement_date) {
        throw new Error('Statement date is required');
    }
    if (!statementData.statement_balance) {
        throw new Error('Statement balance is required');
    }

    // Save reconciliation record (essential for history tracking)
    const statementResponse = await fetch(`${API_BASE_URL}/reconciliations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(statementData)
    });
    
    if (!statementResponse.ok) {
        const errorDetails = await statementResponse.text();
        console.error('Failed to save reconciliation record:', errorDetails);
        
        // Still show warning but don't fail since transactions were reconciled
        showNotification('Could no save last statment record.', 'warning');
    }
    showNotification(`Last statement data saved successfully!`, 'success');
    await openReconcileModal(accountId);
   
}

