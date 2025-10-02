const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

class CheckBookAPI {
    constructor(dbPath) {
        this.app = express();
        this.dbPath = dbPath || './checkbook-pro.sqlite3';
        this.db = null;
        
        this.setupMiddleware();
        this.connectDatabase();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Production: Remove verbose request logging
        // this.app.use((req, res, next) => {
        //     console.log(`${req.method} ${req.path} - Body:`, Object.keys(req.body).length > 0 ? req.body : 'EMPTY');
        //     next();
        // });
    }

    connectDatabase() {

        let dbExist = fs.existsSync(this.dbPath) ? true : false;
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error connecting to SQLite database:', err);
                throw err;
            }
            console.log('Connected to SQLite database');
            // Add performance indexes for reconcile operations
            if(dbExist === false) this.createDatabase();
        });
    }

    createDatabase() {
        console.log('Creating tables and indexes if do not exist...');
        
        const sqls = [

        `BEGIN`,
        // Table: accounts
        `CREATE TABLE IF NOT EXISTS accounts (
            id                  TEXT    PRIMARY KEY,
            checkbook_id        TEXT    NOT NULL,
            account_code        TEXT,
            parent_code         TEXT,
            account_name        TEXT    NOT NULL,
            account_type        TEXT    NOT NULL,
            opening_balance     REAL    NOT NULL  DEFAULT 0,
            account_balance     REAL    NOT NULL  DEFAULT 0,
            account_description TEXT,
            is_active           INTEGER NOT NULL  DEFAULT 1,
            created_at          TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP,
            updated_at          TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP
        )`,

        // Table: checkbooks
        `CREATE TABLE IF NOT EXISTS checkbooks (
            id             TEXT    PRIMARY KEY,
            checkbook_name TEXT    NOT NULL,
            description    TEXT,
            is_active      INTEGER NOT NULL  DEFAULT 1,
            created_at     TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP,
            updated_at     TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP
        )`,

        // Table: reconciliations
        `CREATE TABLE IF NOT EXISTS reconciliations (
            id                 TEXT PRIMARY KEY,
            checkbook_id       TEXT NOT NULL,
            account_id         TEXT NOT NULL,
            statement_date     TEXT NOT NULL,
            statement_balance  REAL NOT NULL,
            reconciled_balance REAL NOT NULL,
            difference         REAL NOT NULL  DEFAULT 0,
            created_at         TEXT NOT NULL  DEFAULT CURRENT_TIMESTAMP,
            updated_at         TEXT NOT NULL  DEFAULT CURRENT_TIMESTAMP
        )`,

        // Table: transactions
        `CREATE TABLE IF NOT EXISTS transactions (
            id               TEXT    PRIMARY KEY,
            checkbook_id     TEXT    NOT NULL,
            transaction_type TEXT    NOT NULL,
            transaction_date TEXT    NOT NULL,
            from_account_id  TEXT    NOT NULL,
            to_account_id    TEXT,
            amount           REAL    NOT NULL,
            reference_number TEXT,
            description      TEXT,
            is_reconciled    INTEGER NOT NULL  DEFAULT 0,
            created_at       TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP
        )`,

        // Table: users
        `CREATE TABLE IF NOT EXISTS users (
            id             TEXT PRIMARY KEY,
            username       TEXT NOT NULL,
            password       TEXT NOT NULL,
            user_role      TEXT NOT NULL  DEFAULT 'user',
            checkbook_id   TEXT NOT NULL,
            checkbook_name TEXT NOT NULL,
            created_at     TEXT NOT NULL  DEFAULT CURRENT_TIMESTAMP
        )`,
        `COMMIT`,

        `BEGIN`,
        // Index: idx_accounts_checkbook
        `CREATE INDEX IF NOT EXISTS idx_accounts_checkbook ON accounts (checkbook_id)`,

        // Index: idx_accounts_checkbook_active_code
        `CREATE INDEX IF NOT EXISTS idx_accounts_checkbook_active_code ON accounts (checkbook_id, is_active, account_code)`,

        // Index: idx_accounts_checkbook_active_type
        `CREATE INDEX IF NOT EXISTS idx_accounts_checkbook_active_type ON accounts (checkbook_id, is_active, account_type)`,

        // Index: idx_accounts_code
        `CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts (account_code)`,

        // Index: idx_accounts_type
        `CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (account_type)`,

        // Index: idx_reconciliations_account
        `CREATE INDEX IF NOT EXISTS idx_reconciliations_account ON reconciliations (account_id)`,

        // Index: idx_reconciliations_date
        `CREATE INDEX IF NOT EXISTS idx_reconciliations_date ON reconciliations (statement_date)`,

        // Index: idx_transactions_checkbook
        `CREATE INDEX IF NOT EXISTS idx_transactions_checkbook ON transactions (checkbook_id)`,

        // Index: idx_transactions_date
        `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date)`,

        // Index: idx_transactions_from_account
        `CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions (from_account_id)`,

        // Index: idx_transactions_reconciled
        `CREATE INDEX IF NOT EXISTS idx_transactions_reconciled ON transactions (is_reconciled)`,

        // Index: idx_transactions_to_account
        `CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions (to_account_id)`,

        // Index: idx_tx_checkbook_date_reconciled
        `CREATE INDEX IF NOT EXISTS idx_tx_checkbook_date_reconciled ON transactions (checkbook_id, transaction_date, is_reconciled)`,

        // Index: idx_tx_checkbook_type_date
        `CREATE INDEX IF NOT EXISTS idx_tx_checkbook_type_date ON transactions (checkbook_id, transaction_type, transaction_date)`,

        // Index: idx_tx_from_account_amount
        `CREATE INDEX IF NOT EXISTS idx_tx_from_account_amount ON transactions (from_account_id, amount)`,

        // Index: idx_tx_from_account_date_reconciled
        `CREATE INDEX IF NOT EXISTS idx_tx_from_account_date_reconciled ON transactions (from_account_id, transaction_date, is_reconciled)`,

        // Index: idx_tx_to_account_amount
        `CREATE INDEX IF NOT EXISTS idx_tx_to_account_amount ON transactions (to_account_id, amount)`,

        // Index: idx_tx_to_account_date_reconciled
        `CREATE INDEX IF NOT EXISTS idx_tx_to_account_date_reconciled ON transactions (to_account_id, transaction_date, is_reconciled)`,

        // Index: idx_users_checkbook
        `CREATE INDEX IF NOT EXISTS idx_users_checkbook ON users (checkbook_id, username)`,

        // Index: idx_users_username_checkbook
        `CREATE INDEX IF NOT EXISTS idx_users_username_checkbook ON users (username, checkbook_id)`,
        `COMMIT`,
       
        `BEGIN`,
        // Insert Test Checkbook if does not exist
        `INSERT INTO checkbooks (id, checkbook_name, description, is_active)
        SELECT '9000dfce-2000-4261-ac2d-028bdb754064', 'Initial Checkbook', NULL, 1
        WHERE NOT EXISTS (SELECT 1 FROM checkbooks)`,

        // Insert admin idx_users_username_checkbook if does not exist
        `INSERT INTO users (id, username, password, user_role, checkbook_id, checkbook_name)
        SELECT '71f502cc-b843-430b-942d-5e794396d45c', 'admin', 'd650bc815fc040d865bf5defa0b7200daf14cba6ae84c0248cccbe21945d97f7',
        'admin', '9000dfce-2000-4261-ac2d-028bdb754064', 'Initial Checkbook'
        WHERE NOT EXISTS (SELECT 1 FROM users)`,
        `COMMIT`,

        // Pragmas
        `PRAGMA journal_mode=WAL`,
        `PRAGMA synchronous=NORMAL`, 
        `PRAGMA cache_size=-8000`,
        `PRAGMA temp_store=MEMORY`,
        `PRAGMA foreign_keys=ON`
            
        ];

        let completed = 0;
        const total = sqls.length;      
        sqls.forEach((sql, i) => {
            this.db.exec(sql, (err) => {
                completed++;
                if (err) {
                    console.warn(`Warning: Could not create index ${(i + 1) + ' ' + sql}:`, err.message);
                } else {
                    console.log(`✅ Created performance index ${completed}/${total}`);
                }
                
                if (completed === total) {
                    console.log('🚀 Initial Database created successfully');
                }
            });
        });
    }

    setupRoutes() {
        // Authentication routes
        this.app.post('/api/auth/login', this.handleLogin.bind(this));
        
        // Checkbook routes
        this.app.get('/api/checkbooks', this.getCheckbooks.bind(this));
        this.app.get('/api/checkbooks/:id', this.getCheckbook.bind(this));
        this.app.post('/api/checkbooks', this.createCheckbook.bind(this));
        this.app.put('/api/checkbooks/:id', this.updateCheckbook.bind(this));
        this.app.delete('/api/checkbooks/:id', this.deleteCheckbook.bind(this));
        
        // User routes
        this.app.get('/api/users', this.getUsers.bind(this));
        this.app.post('/api/users', this.createUser.bind(this));
        this.app.put('/api/users/:id', this.updateUser.bind(this));
        this.app.delete('/api/users/:id', this.deleteUser.bind(this));
        this.app.post('/api/reset-password', this.resetPassword.bind(this));
        
        // Account routes
        this.app.get('/api/accounts', this.getAccounts.bind(this));
        this.app.get('/api/accounts/checkbook/:checkbook_id', this.getAccountsByCheckbook.bind(this));
        this.app.get('/api/accounts/:id', this.getAccount.bind(this));
        this.app.post('/api/accounts', this.createAccount.bind(this));
        this.app.put('/api/accounts/:id', this.updateAccount.bind(this));
        this.app.put('/api/accounts/:id/balance', this.updateAccountBalance.bind(this));
        this.app.post('/api/accounts/sync-balances/:checkbook_id', this.syncAccountBalances.bind(this));
        this.app.delete('/api/accounts/:id', this.deleteAccount.bind(this));
        
        // Transaction routes
        this.app.get('/api/transactions', this.getTransactions.bind(this));
        this.app.get('/api/transactions/checkbook/:checkbook_id', this.getTransactionsByCheckbook.bind(this));
        this.app.get('/api/transactions/account/:account_id', this.getTransactionsByAccount.bind(this));
        this.app.get('/api/transactions/:id', this.getTransaction.bind(this));
        this.app.post('/api/transactions', this.createTransaction.bind(this));
        this.app.post('/api/transactions/bulk-import', this.bulkImportTransactions.bind(this));
        this.app.put('/api/transactions/:id', this.updateTransaction.bind(this));
        this.app.delete('/api/transactions/:id', this.deleteTransaction.bind(this));
        this.app.put('/api/transactions/:id/reconcile', this.reconcileTransaction.bind(this));
        this.app.put('/api/transactions/bulk-reconcile', this.bulkReconcileTransactions.bind(this));
        
        // Reconciliation routes
        this.app.get('/api/reconciliations', this.getReconciliations.bind(this));
        this.app.get('/api/reconciliations/account/:account_id', this.getReconciliationsByAccount.bind(this));
        this.app.post('/api/reconciliations', this.createReconciliation.bind(this));
        
        // Report routes
        this.app.get('/api/reports/profit-loss/:checkbook_id', this.getProfitLossReport.bind(this));
        this.app.get('/api/reports/chart-of-accounts/:checkbook_id', this.getChartOfAccountsReport.bind(this));
        this.app.get('/api/reports/balance-sheet/:checkbook_id', this.getBalanceSheetReport.bind(this));
        this.app.get('/api/reports/transaction-detail/:checkbook_id', this.getTransactionDetailReport.bind(this));
        this.app.get('/api/reports/account-history/:account_id', this.getAccountHistoryReport.bind(this));
        this.app.get('/api/reports/dashboard-ytd/:checkbook_id', this.getDashboardYTDReport.bind(this));
        this.app.get('/api/reports/dashboard-mtd/:checkbook_id', this.getDashboardMTDReport.bind(this));
    }

    // Helper methods
    sendSuccess(res, data = null, message = 'Success') {
        res.json({
            status: 'success',
            message: message,
            data: data
        });
    }

    sendError(res, message = 'Error', statusCode = 400) {
        res.status(statusCode).json({
            status: 'error',
            message: message,
            data: null
        });
    }

    // Authentication methods
    async handleLogin(req, res) {
        try {
            const { username, password, checkbook, checkbook_id } = req.body;
            
            // Accept either 'checkbook' or 'checkbook_id' parameter
            const checkbookId = checkbook || checkbook_id;
            
            if (!username || !password || !checkbookId) {
                return this.sendError(res, 'Username, password, and checkbook are required', 400);
            }

            const query = 'SELECT * FROM users WHERE username = ? AND checkbook_id = ?';
            this.db.get(query, [username, checkbookId], (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    return this.sendError(res, 'Database error', 500);
                }

                if (!user) {
                    return this.sendError(res, 'Invalid credentials', 401);
                }

                // Handle different password formats (from PHP version)
                this.verifyPassword(password, user.password, (isValid) => {
                    if (isValid) {
                        // Remove password from response
                        const { password: _, ...userWithoutPassword } = user;
                        this.sendSuccess(res, userWithoutPassword, 'Login successful');
                    } else {
                        this.sendError(res, 'Invalid credentials', 401);
                    }
                });
            });
        } catch (error) {
            console.error('Login error:', error);
            this.sendError(res, 'Internal server error', 500);
        }
    }

    verifyPassword(plainPassword, hashedPassword, callback) {
        console.log('Verifying password for hash:', hashedPassword.substring(0, 20) + '...');
        
        // Try simple hash first (new format for desktop app)
        const simpleHash = crypto.createHash('sha256').update(plainPassword + 'checkbook-pro-salt').digest('hex');
        if (simpleHash === hashedPassword) {
            console.log('Password verified with simple hash');
            return callback(true);
        }
            
        // Handle legacy formats from PHP
            if (hashedPassword.includes(':')) {
                // Salt:hash format
                const [salt, hash] = hashedPassword.split(':', 2);
                const crypto = require('crypto');
                const testHash = crypto.createHash('sha256').update(salt + crypto.createHash('sha256').update(plainPassword).digest('hex')).digest('hex');
                if (testHash === hash) {
                    console.log('Password verified with salt:hash format');
                    return callback(true);
                }
            } else if (hashedPassword.length === 64) {
                // Simple SHA256
                const crypto = require('crypto');
                const testHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
                if (testHash === hashedPassword) {
                    console.log('Password verified with SHA256');
                    return callback(true);
                }
                
                // Try MD5 as well (common in older PHP apps)
                const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
                if (md5Hash === hashedPassword) {
                    console.log('Password verified with MD5');
                    return callback(true);
                }
            } else if (hashedPassword.length === 32) {
                // Try MD5 for 32-character hashes
                const crypto = require('crypto');
                const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
                if (md5Hash === hashedPassword) {
                    console.log('Password verified with MD5');
                    return callback(true);
                }
            }
            
        console.log('Password verification failed - no matching format found');
        callback(false);
    }

    // Checkbook methods
    getCheckbooks(req, res) {
        const query = `
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM users WHERE checkbook_id = c.id) as user_count,
                (SELECT COUNT(*) FROM accounts WHERE checkbook_id = c.id) as account_count,
                (SELECT COUNT(*) FROM transactions t 
                 INNER JOIN accounts a ON t.from_account_id = a.id 
                 WHERE a.checkbook_id = c.id) as transaction_count
            FROM checkbooks c 
            WHERE c.is_active = 1
        `;
        this.db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getCheckbook(req, res) {
        const { id } = req.params;
        const query = 'SELECT * FROM checkbooks WHERE id = ?';
        this.db.get(query, [id], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            if (!row) {
                return this.sendError(res, 'Checkbook not found', 404);
            }
            this.sendSuccess(res, row);
        });
    }

    createCheckbook(req, res) {
        const { checkbook_name, description } = req.body;
        
        if (!checkbook_name) {
            return this.sendError(res, 'Checkbook name is required', 400);
        }
        
        const id = 'checkbook_' + Date.now() + Math.random().toString(36).substr(2, 9);
        const query = `
            INSERT INTO checkbooks (id, checkbook_name, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
        `;
        
        this.db.run(query, [id, checkbook_name, description || ''], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.status(201).json({
                status: 'success',
                message: 'Checkbook created successfully',
                data: { id, checkbook_name, description }
            });
        });
    }

    updateCheckbook(req, res) {
        const { id } = req.params;
        const { checkbook_name, description, is_active } = req.body;
        
        let query = 'UPDATE checkbooks SET ';
        let params = [];
        let updates = [];

        const fields = { checkbook_name, description, is_active };

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updates.length === 0) {
            return this.sendError(res, 'No fields to update', 400);
        }

        query += updates.join(', ') + ', updated_at = datetime("now") WHERE id = ?';
        params.push(id);

        this.db.run(query, params, function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Checkbook not found' });
            }
            res.json({ status: 'success', message: 'Checkbook updated successfully' });
        });
    }

    deleteCheckbook(req, res) {
        const { id } = req.params;
        const query = 'DELETE FROM checkbooks WHERE id = ?';
        
        this.db.run(query, [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Checkbook not found' });
            }
            res.json({ status: 'success', message: 'Checkbook deleted successfully' });
        });
    }

    // User methods
    getUsers(req, res) {
        const query = 'SELECT id, username, user_role, checkbook_id, checkbook_name, created_at FROM users';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    createUser(req, res) {
        const { username, password, user_role = 'user', checkbook_id, checkbook_name } = req.body;
        
        if (!username || !password || !checkbook_id) {
            return this.sendError(res, 'Username, password, and checkbook_id are required', 400);
        }

        const id = 'user_' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Use simple hashing for desktop app
        const hashedPassword = crypto.createHash('sha256').update(password + 'checkbook-pro-salt').digest('hex');

        const query = `
                INSERT INTO users (id, username, password, user_role, checkbook_id, checkbook_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `;
            
        this.db.run(query, [id, username, hashedPassword, user_role, checkbook_id, checkbook_name], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.status(201).json({ 
                status: 'success', 
                message: 'User created successfully',
                data: { id, username, user_role, checkbook_id, checkbook_name }
            });
        });
    }

    updateUser(req, res) {
        const { id } = req.params;
        const { username, password, user_role } = req.body;
        
        let query = 'UPDATE users SET ';
        let params = [];
        let updates = [];

        if (username) {
            updates.push('username = ?');
            params.push(username);
        }
        if (user_role) {
            updates.push('user_role = ?');
            params.push(user_role);
        }
        if (password) {
            const hashedPassword = crypto.createHash('sha256').update(password + 'checkbook-pro-salt').digest('hex');
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return this.sendError(res, 'No fields to update', 400);
        }

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        this.db.run(query, params, function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }
            res.json({ status: 'success', message: 'User updated successfully' });
        });
    }

    deleteUser(req, res) {
        const { id } = req.params;
        const query = 'DELETE FROM users WHERE id = ?';
        
        this.db.run(query, [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }
            res.json({ status: 'success', message: 'User deleted successfully' });
        });
    }

    resetPassword(req, res) {
        const { username, checkbook_id, new_password } = req.body;
        
        if (!username || !checkbook_id || !new_password) {
            return this.sendError(res, 'Username, checkbook_id, and new_password are required', 400);
        }

        // Use simple hashing for desktop app
        const hashedPassword = crypto.createHash('sha256').update(new_password + 'checkbook-pro-salt').digest('hex');

        const query = 'UPDATE users SET password = ? WHERE username = ? AND checkbook_id = ?';
        this.db.run(query, [hashedPassword, username, checkbook_id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }
            res.json({ status: 'success', message: 'Password reset successfully' });
        });
    }

    // Account methods
    getAccounts(req, res) {
        const { checkbook_id } = req.query;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        const query = 'SELECT * FROM accounts WHERE checkbook_id = ? AND is_active = 1 ORDER BY account_code';
        this.db.all(query, [checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getAccountsByCheckbook(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        const query = 'SELECT * FROM accounts WHERE checkbook_id = ? AND is_active = 1 ORDER BY account_code';
        this.db.all(query, [checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getAccount(req, res) {
        const { id } = req.params;
        const query = 'SELECT * FROM accounts WHERE id = ?';
        this.db.get(query, [id], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            if (!row) {
                return this.sendError(res, 'Account not found', 404);
            }
            this.sendSuccess(res, row);
        });
    }

    createAccount(req, res) {
        const { 
            checkbook_id, account_code, parent_code, account_name, 
            account_type, opening_balance = 0, account_balance = 0, 
            account_description, is_active = 1 
        } = req.body;
        
        if (!checkbook_id || !account_name || !account_type) {
            return this.sendError(res, 'checkbook_id, account_name, and account_type are required', 400);
        }

        const id = 'account_' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        const query = `
            INSERT INTO accounts (
                id, checkbook_id, account_code, parent_code, account_name, 
                account_type, opening_balance, account_balance, account_description, 
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        this.db.run(query, [
            id, checkbook_id, account_code, parent_code, account_name,
            account_type, opening_balance, account_balance, account_description, is_active
        ], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.status(201).json({ 
                status: 'success', 
                message: 'Account created successfully',
                data: { id }
            });
        });
    }

    updateAccount(req, res) {
        const { id } = req.params;
        const { 
            account_code, parent_code, account_name, account_type, 
            opening_balance, account_balance, account_description, is_active 
        } = req.body;
        
        let query = 'UPDATE accounts SET ';
        let params = [];
        let updates = [];

        const fields = {
            account_code, parent_code, account_name, account_type,
            opening_balance, account_balance, account_description, is_active
        };

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updates.length === 0) {
            return this.sendError(res, 'No fields to update', 400);
        }

        updates.push('updated_at = datetime(\'now\')');
        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        this.db.run(query, params, function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Account not found' });
            }
            res.json({ status: 'success', message: 'Account updated successfully' });
        });
    }

    deleteAccount(req, res) {
        const { id } = req.params;
        const query = 'DELETE FROM accounts WHERE id = ?';
        
        this.db.run(query, [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Account not found' });
            }
            res.json({ status: 'success', message: 'Account deleted successfully' });
        });
    }

    // Transaction methods
    getTransactions(req, res) {
        const { checkbook_id, account_id, start_date, end_date, limit = 50 } = req.query;
        
        let query = `
            SELECT 
                t.*,
                fa.account_name as from_account_name,
                ta.account_name as to_account_name,
                fa.account_type as from_account_type,
                ta.account_type as to_account_type
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE 1=1
        `;
        let params = [];

        if (checkbook_id) {
            query += ' AND t.checkbook_id = ?';
            params.push(checkbook_id);
        }
        if (account_id) {
            query += ' AND (t.from_account_id = ? OR t.to_account_id = ?)';
            params.push(account_id, account_id);
        }
        if (start_date && end_date) {
            query += ' AND t.transaction_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        query += ' ORDER BY t.transaction_date DESC, t.ROWID DESC LIMIT ?';
        params.push(parseInt(limit));

        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getTransactionsByCheckbook(req, res) {
        const { checkbook_id } = req.params;
        const { account_id, start_date, end_date, limit = 50, all = false } = req.query;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        let query = `
            SELECT 
                t.*,
                fa.account_name as from_account_name,
                ta.account_name as to_account_name,
                fa.account_type as from_account_type,
                ta.account_type as to_account_type
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE t.checkbook_id = ?
        `;
        let params = [checkbook_id];

        if (account_id) {
            query += ' AND (t.from_account_id = ? OR t.to_account_id = ?)';
            params.push(account_id, account_id);
        }
        if (start_date && end_date) {
            query += ' AND t.transaction_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        query += ' ORDER BY t.transaction_date DESC, t.ROWID DESC';
        
        // Only add LIMIT if not requesting all transactions
        if (all !== 'true' && all !== true) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            // Return empty array if no transactions found, not an error
            console.log(`Found ${(rows || []).length} transactions for checkbook ${checkbook_id}`);
            this.sendSuccess(res, rows || []);
        });
    }

    getTransactionsByAccount(req, res) {
        const { account_id } = req.params;
        const { start_date, end_date, limit = 50 } = req.query;
        
        if (!account_id) {
            return this.sendError(res, 'account_id parameter is required', 400);
        }

        let query = `
            SELECT 
                t.*,
                fa.account_name as from_account_name,
                ta.account_name as to_account_name,
                fa.account_type as from_account_type,
                ta.account_type as to_account_type
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE (t.from_account_id = ? OR t.to_account_id = ?)
        `;
        let params = [account_id, account_id];

        if (start_date && end_date) {
            query += ' AND t.transaction_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        query += ' ORDER BY t.transaction_date DESC, t.ROWID DESC LIMIT ?';
        params.push(parseInt(limit));

        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getTransaction(req, res) {
        const { id } = req.params;
        const query = 'SELECT * FROM transactions WHERE id = ?';
        this.db.get(query, [id], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            if (!row) {
                return this.sendError(res, 'Transaction not found', 404);
            }
            this.sendSuccess(res, row);
        });
    }

    // Helper method to compute balance delta based on account type and money flow direction
    computeDelta(accountType, direction, amount) {
        // Accounting rules + flow direction matrix:
        // Asset/Expense: IN = +amount, OUT = -amount
        // Liability/Income: IN = +amount, OUT = -amount (same as assets for money flow)
        
        if (accountType === 'asset' || accountType === 'expense') {
            return direction === 'IN' ? amount : -amount;
        } else if (accountType === 'liability') {
            // For liability: money IN reduces debt (+), money OUT increases debt (-)
            return direction === 'IN' ? amount : -amount;
        } else { // income
            // For income: money IN increases income (+), money OUT decreases income (-)
            return direction === 'IN' ? amount : -amount;
        }
    }

    createTransaction(req, res) {
        const {
            checkbook_id, transaction_type, transaction_date,
            from_account_id, to_account_id, amount, reference_number,
            description, is_reconciled = 0
        } = req.body;
        
        if (!checkbook_id || !transaction_type || !transaction_date || !from_account_id || amount === undefined || amount === null) {
            return this.sendError(res, 'Missing required transaction fields', 400);
        }

        const id = 'transaction_' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        const query = `
            INSERT INTO transactions (
                id, checkbook_id, transaction_type, transaction_date,
                from_account_id, to_account_id, amount, reference_number,
                description, is_reconciled, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        
        this.db.run(query, [
            id, checkbook_id, transaction_type, transaction_date,
            from_account_id, to_account_id, amount, reference_number,
            description, is_reconciled
        ], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            
            // Update account balances using direction-aware proper accounting
            const amountFloat = parseFloat(amount);
            
            // First, fetch account types for accounts
            const accountIds = to_account_id ? [from_account_id, to_account_id] : [from_account_id];
            const placeholders = accountIds.length === 2 ? '(?, ?)' : '(?)';
            const getAccountTypeQuery = `SELECT id, account_type FROM accounts WHERE id IN ${placeholders}`;
            
            this.db.all(getAccountTypeQuery, accountIds, (typeErr, accounts) => {
                if (typeErr) {
                    console.error('Error fetching account types:', typeErr);
                    return;
                }
                
                // Create a map of account_id -> account_type
                const accountTypeMap = {};
                accounts.forEach(acc => {
                    accountTypeMap[acc.id] = acc.account_type;
                });
                
                const fromAccountType = accountTypeMap[from_account_id];
                const toAccountType = to_account_id ? accountTypeMap[to_account_id] : null;
                
                // Determine money flow direction based on transaction type
                let fromDirection, toDirection;
                if (transaction_type === 'debit') {
                    fromDirection = 'OUT';  // Money going OUT of from_account
                    toDirection = 'IN';     // Money coming IN to to_account
                } else { // credit
                    fromDirection = 'IN';   // Money coming IN to from_account
                    toDirection = 'OUT';    // Money going OUT of to_account
                }
                
                // Compute balance deltas using proper accounting rules + flow direction
                const fromDelta = this.computeDelta(fromAccountType, fromDirection, amountFloat);
                const toDelta = toAccountType ? this.computeDelta(toAccountType, toDirection, amountFloat) : null;
                
                // Apply FROM account balance change
                const fromQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
                this.db.run(fromQuery, [fromDelta, from_account_id], (fromErr) => {
                    if (fromErr) {
                        console.error('Error updating from account balance:', fromErr);
                    }
                    
                    // Apply TO account balance change (if specified)
                    if (to_account_id && toDelta !== null) {
                        const toQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
                        this.db.run(toQuery, [toDelta, to_account_id], (toErr) => {
                            if (toErr) {
                                console.error('Error updating to account balance:', toErr);
                            }
                        });
                    }
                });
            });
            
            res.status(201).json({ 
                status: 'success', 
                message: 'Transaction created successfully',
                data: { id }
            });
        });
    }

    updateTransaction(req, res) {
        const { id } = req.params;
        const {
            transaction_type, transaction_date, from_account_id, to_account_id,
            amount, reference_number, description, is_reconciled
        } = req.body;
        
        // Validate required fields
        if (!transaction_type || !transaction_date || !from_account_id || !amount) {
            return this.sendError(res, 'Missing required transaction fields: transaction_type, transaction_date, from_account_id, and amount are required', 400);
        }
        
        // First get the original transaction
        this.db.get('SELECT * FROM transactions WHERE id = ?', [id], (getErr, originalTransaction) => {
            if (getErr) {
                console.error('Database error getting original transaction:', getErr);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (!originalTransaction) {
                return res.status(404).json({ status: 'error', message: 'Transaction not found' });
            }
            
            let query = 'UPDATE transactions SET ';
            let params = [];
            let updates = [];

            const fields = {
                transaction_type, transaction_date, from_account_id, to_account_id,
                amount, reference_number, description, is_reconciled
            };

            for (const [key, value] of Object.entries(fields)) {
                if (value !== undefined) {
                    updates.push(`${key} = ?`);
                    params.push(value);
                }
            }

            if (updates.length === 0) {
                return this.sendError(res, 'No fields to update', 400);
            }

            query += updates.join(', ') + ' WHERE id = ?';
            params.push(id);

            // Check if balance-affecting fields changed
            const balanceFieldsChanged = amount !== undefined || from_account_id !== undefined || to_account_id !== undefined;
            
            if (balanceFieldsChanged) {
                // Reverse original transaction balance effects first
                const originalAmount = parseFloat(originalTransaction.amount);
                const originalType = originalTransaction.transaction_type;
                const originalFromId = originalTransaction.from_account_id;
                const originalToId = originalTransaction.to_account_id;
                
                // Reverse original transaction effects using account-type-aware logic
                const originalAccountIds = originalToId ? [originalFromId, originalToId] : [originalFromId];
                const originalPlaceholders = originalAccountIds.length === 2 ? '(?, ?)' : '(?)';
                const getOriginalAccountTypesQuery = `SELECT id, account_type FROM accounts WHERE id IN ${originalPlaceholders}`;
                
                this.db.all(getOriginalAccountTypesQuery, originalAccountIds, (origTypeErr, originalAccounts) => {
                    if (origTypeErr) {
                        console.error('Error fetching original account types:', origTypeErr);
                        return res.status(500).json({ status: 'error', message: 'Database error' });
                    }
                    
                    // Create map of original account types
                    const originalAccountTypeMap = {};
                    originalAccounts.forEach(acc => {
                        originalAccountTypeMap[acc.id] = acc.account_type;
                    });
                    
                    const originalFromType = originalAccountTypeMap[originalFromId];
                    const originalToType = originalToId ? originalAccountTypeMap[originalToId] : null;
                    
                    // Determine original transaction flow direction
                    let originalFromDirection, originalToDirection;
                    if (originalType === 'debit') {
                        originalFromDirection = 'OUT';  // Money going OUT of from_account
                        originalToDirection = 'IN';     // Money coming IN to to_account
                    } else { // credit
                        originalFromDirection = 'IN';   // Money coming IN to from_account
                        originalToDirection = 'OUT';    // Money going OUT of to_account
                    }
                    
                    // Calculate what the original transaction actually did using computeDelta
                    const originalFromDelta = this.computeDelta(originalFromType, originalFromDirection, originalAmount);
                    const originalToDelta = originalToType ? this.computeDelta(originalToType, originalToDirection, originalAmount) : null;
                    
                    // Reverse the original transaction by applying negative deltas
                    const reverseFromQuery = "UPDATE accounts SET account_balance = account_balance - ? WHERE id = ?";
                    this.db.run(reverseFromQuery, [originalFromDelta, originalFromId], (reverseFromErr) => {
                        if (reverseFromErr) {
                            console.error('Error reversing from account balance:', reverseFromErr);
                            return res.status(500).json({ status: 'error', message: 'Balance update error' });
                        }
                        
                        // Reverse TO account balance changes (if original had a TO account)
                        if (originalToId && originalToDelta !== null) {
                            const reverseToQuery = "UPDATE accounts SET account_balance = account_balance - ? WHERE id = ?";
                            this.db.run(reverseToQuery, [originalToDelta, originalToId], (reverseToErr) => {
                                if (reverseToErr) {
                                    console.error('Error reversing to account balance:', reverseToErr);
                                    return res.status(500).json({ status: 'error', message: 'Balance update error' });
                                }
                                
                                // Now update transaction and apply new balance effects
                                this.completeTransactionUpdate(query, params, fields, originalTransaction, res);
                            });
                        } else {
                            // No original TO account, proceed with update
                            this.completeTransactionUpdate(query, params, fields, originalTransaction, res);
                        }
                    });
                });
            } else {
                // No balance fields changed, simple update
                this.db.run(query, params, function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ status: 'error', message: 'Database error' });
                    }
                    res.json({ status: 'success', message: 'Transaction updated successfully' });
                });
            }
        });
    }
    
    completeTransactionUpdate(query, params, fields, originalTransaction, res) {
        // Update the transaction
        this.db.run(query, params, (updateErr) => {
            if (updateErr) {
                console.error('Database error updating transaction:', updateErr);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            
            // Apply new transaction's effect on balances using account-type-aware logic
            const newAmount = parseFloat(fields.amount !== undefined ? fields.amount : originalTransaction.amount);
            const newType = fields.transaction_type !== undefined ? fields.transaction_type : originalTransaction.transaction_type;
            const newFromId = fields.from_account_id !== undefined ? fields.from_account_id : originalTransaction.from_account_id;
            const newToId = fields.to_account_id !== undefined ? fields.to_account_id : originalTransaction.to_account_id;
            
            // Fetch account types for new transaction accounts
            const newAccountIds = newToId ? [newFromId, newToId] : [newFromId];
            const newPlaceholders = newAccountIds.length === 2 ? '(?, ?)' : '(?)';
            const getNewAccountTypesQuery = `SELECT id, account_type FROM accounts WHERE id IN ${newPlaceholders}`;
            
            this.db.all(getNewAccountTypesQuery, newAccountIds, (newTypeErr, newAccounts) => {
                if (newTypeErr) {
                    console.error('Error fetching new account types:', newTypeErr);
                    return res.status(500).json({ status: 'error', message: 'Database error' });
                }
                
                // Create map of new account types
                const newAccountTypeMap = {};
                newAccounts.forEach(acc => {
                    newAccountTypeMap[acc.id] = acc.account_type;
                });
                
                const newFromType = newAccountTypeMap[newFromId];
                const newToType = newToId ? newAccountTypeMap[newToId] : null;
                
                // Determine new transaction flow direction
                let newFromDirection, newToDirection;
                if (newType === 'debit') {
                    newFromDirection = 'OUT';  // Money going OUT of from_account
                    newToDirection = 'IN';     // Money coming IN to to_account
                } else { // credit
                    newFromDirection = 'IN';   // Money coming IN to from_account  
                    newToDirection = 'OUT';    // Money going OUT of to_account
                }
                
                // Compute balance deltas using proper accounting rules + flow direction
                const newFromDelta = this.computeDelta(newFromType, newFromDirection, newAmount);
                const newToDelta = newToType ? this.computeDelta(newToType, newToDirection, newAmount) : null;
                
                // Apply new FROM account balance change
                const newFromQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
                this.db.run(newFromQuery, [newFromDelta, newFromId], (newFromErr) => {
                    if (newFromErr) {
                        console.error('Error applying new from account balance:', newFromErr);
                        return res.status(500).json({ status: 'error', message: 'Balance update error' });
                    }
                    
                    // Apply new TO account balance change (if specified)
                    if (newToId && newToDelta !== null) {
                        const newToQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
                        this.db.run(newToQuery, [newToDelta, newToId], (newToErr) => {
                            if (newToErr) {
                                console.error('Error applying new to account balance:', newToErr);
                                return res.status(500).json({ status: 'error', message: 'Balance update error' });
                            }
                            res.json({ status: 'success', message: 'Transaction updated successfully' });
                        });
                    } else {
                        res.json({ status: 'success', message: 'Transaction updated successfully' });
                    }
                });
            });
        });
    }

    deleteTransaction(req, res) {
        const { id } = req.params;
        
        // First get the transaction to reverse its balance effects
        this.db.get('SELECT * FROM transactions WHERE id = ?', [id], (getErr, transaction) => {
            if (getErr) {
                console.error('Database error getting transaction for deletion:', getErr);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (!transaction) {
                return res.status(404).json({ status: 'error', message: 'Transaction not found' });
            }
            
            // Reverse the transaction's balance effects before deleting
            const amount = parseFloat(transaction.amount);
            const transactionType = transaction.transaction_type;
            const fromAccountId = transaction.from_account_id;
            const toAccountId = transaction.to_account_id;
            
            // Reverse FROM account balance changes
            let reverseFromQuery;
            if (transactionType === 'credit') {
                // Original was CREDIT: we added to FROM account, now subtract to reverse
                reverseFromQuery = "UPDATE accounts SET account_balance = account_balance - ? WHERE id = ?";
            } else {
                // Original was DEBIT: we subtracted from FROM account, now add to reverse
                reverseFromQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
            }
            
            this.db.run(reverseFromQuery, [amount, fromAccountId], (reverseFromErr) => {
                if (reverseFromErr) {
                    console.error('Error reversing from account balance for deletion:', reverseFromErr);
                    return res.status(500).json({ status: 'error', message: 'Balance update error' });
                }
                
                // Reverse TO account balance changes (if transaction had a TO account)
                if (toAccountId) {
                    let reverseToQuery;
                    if (transactionType === 'credit') {
                        // Original was CREDIT: we subtracted from TO account, now add to reverse
                        reverseToQuery = "UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?";
                    } else {
                        // Original was DEBIT: we added to TO account, now subtract to reverse
                        reverseToQuery = "UPDATE accounts SET account_balance = account_balance - ? WHERE id = ?";
                    }
                    
                    this.db.run(reverseToQuery, [amount, toAccountId], (reverseToErr) => {
                        if (reverseToErr) {
                            console.error('Error reversing to account balance for deletion:', reverseToErr);
                            return res.status(500).json({ status: 'error', message: 'Balance update error' });
                        }
                        
                        // Now delete the transaction
                        this.completeTransactionDeletion(id, res);
                    });
                } else {
                    // No TO account, proceed with deletion
                    this.completeTransactionDeletion(id, res);
                }
            });
        });
    }
    
    completeTransactionDeletion(id, res) {
        const query = 'DELETE FROM transactions WHERE id = ?';
        this.db.run(query, [id], function(err) {
            if (err) {
                console.error('Database error deleting transaction:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Transaction deleted successfully' });
        });
    }

    bulkReconcileTransactions(req, res) {
        const { transaction_ids } = req.body;
        
        if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
            return this.sendError(res, 'transaction_ids array is required', 400);
        }
        
        const placeholders = transaction_ids.map(() => '?').join(',');
        const query = `UPDATE transactions SET is_reconciled = 1 WHERE id IN (${placeholders})`;
        
        this.db.run(query, transaction_ids, function(err) {
            if (err) {
                console.error('Database error bulk reconciling transactions:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ 
                status: 'success', 
                message: 'Transactions marked as reconciled',
                data: { updated_count: this.changes }
            });
        });
    }

    updateAccountBalance(req, res) {
        const { id } = req.params;
        const { balance } = req.body;
        
        if (balance === undefined) {
            return this.sendError(res, 'Balance is required', 400);
        }
        
        const query = 'UPDATE accounts SET account_balance = ?, updated_at = datetime("now") WHERE id = ?';
        
        this.db.run(query, [parseFloat(balance), id], function(err) {
            if (err) {
                console.error('Database error updating account balance:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Account not found' });
            }
            res.json({ status: 'success', message: 'Account balance updated successfully' });
        });
    }

    // One-time sync function to recalculate all account_balance fields from transaction data
    syncAccountBalances(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        console.log(`Starting account balance sync for checkbook: ${checkbook_id}`);

        // Get all accounts for this checkbook
        const accountsQuery = 'SELECT id, account_name, account_type, opening_balance FROM accounts WHERE checkbook_id = ? AND is_active = 1';
        
        this.db.all(accountsQuery, [checkbook_id], (err, accounts) => {
            if (err) {
                console.error('Error fetching accounts:', err);
                return this.sendError(res, 'Database error fetching accounts', 500);
            }

            console.log(`Found ${accounts.length} accounts to sync`);
            let processedCount = 0;
            const results = [];

            if (accounts.length === 0) {
                return res.json({ status: 'success', message: 'No accounts found to sync', processed: 0, results: [] });
            }

            accounts.forEach(account => {
                // Calculate transaction net activity for this account
                const transactionQuery = `
                    SELECT 
                        COALESCE(
                            CASE 
                                WHEN ? = 'asset' THEN
                                    -- Asset accounts: DEBIT TO = money in (+), DEBIT FROM = money out (-)
                                    --                CREDIT TO = money out (-), CREDIT FROM = money in (+)
                                    SUM(CASE 
                                        WHEN t.transaction_type = 'debit' AND t.to_account_id = ? THEN t.amount
                                        WHEN t.transaction_type = 'debit' AND t.from_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'credit' AND t.to_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'credit' AND t.from_account_id = ? THEN t.amount
                                        ELSE 0 
                                    END)
                                WHEN ? = 'liability' THEN
                                    -- Liability accounts: CREDIT increases, DEBIT decreases (Credits - Debits)
                                    SUM(CASE 
                                        WHEN t.transaction_type = 'credit' AND t.to_account_id = ? THEN t.amount
                                        WHEN t.transaction_type = 'debit' AND t.from_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'debit' AND t.to_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'credit' AND t.from_account_id = ? THEN t.amount
                                        ELSE 0 
                                    END)
                                WHEN ? = 'equity' THEN
                                    -- Equity accounts: CREDIT increases, DEBIT decreases (Credits - Debits)
                                    SUM(CASE 
                                        WHEN t.transaction_type = 'credit' AND t.to_account_id = ? THEN t.amount
                                        WHEN t.transaction_type = 'debit' AND t.from_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'debit' AND t.to_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'credit' AND t.from_account_id = ? THEN t.amount
                                        ELSE 0 
                                    END)
                                WHEN ? = 'income' THEN
                                    -- Income accounts: CREDIT increases, DEBIT decreases
                                    SUM(CASE 
                                        WHEN t.transaction_type = 'credit' AND t.to_account_id = ? THEN t.amount
                                        WHEN t.transaction_type = 'debit' AND t.from_account_id = ? THEN -t.amount
                                        ELSE 0 
                                    END)
                                WHEN ? = 'expense' THEN
                                    -- Expense accounts: DEBIT increases, CREDIT decreases
                                    SUM(CASE 
                                        WHEN t.transaction_type = 'debit' AND t.to_account_id = ? THEN t.amount
                                        WHEN t.transaction_type = 'credit' AND t.from_account_id = ? THEN -t.amount
                                        WHEN t.transaction_type = 'credit' AND t.to_account_id = ? THEN -t.amount
                                        ELSE 0 
                                    END)
                                ELSE 0
                            END, 0) as transaction_activity
                    FROM transactions t
                    WHERE t.checkbook_id = ? AND (t.from_account_id = ? OR t.to_account_id = ?)
                `;

                this.db.get(transactionQuery, [
                    account.account_type, account.id, account.id, account.id, account.id,  // asset params
                    account.account_type, account.id, account.id, account.id, account.id,  // liability params  
                    account.account_type, account.id, account.id, account.id, account.id,  // equity params
                    account.account_type, account.id, account.id,                          // income params
                    account.account_type, account.id, account.id, account.id,              // expense params
                    checkbook_id, account.id, account.id
                ], (transErr, transResult) => {
                    if (transErr) {
                        console.error(`Error calculating transactions for account ${account.account_name}:`, transErr);
                        processedCount++;
                        results.push({
                            account_name: account.account_name,
                            status: 'error',
                            error: transErr.message
                        });
                    } else {
                        const transactionActivity = transResult.transaction_activity || 0;
                        const newAccountBalance = parseFloat(transactionActivity); // Only transaction sum, no opening_balance

                        // Update the account_balance field
                        const updateQuery = 'UPDATE accounts SET account_balance = ?, updated_at = datetime("now") WHERE id = ?';
                        
                        this.db.run(updateQuery, [newAccountBalance, account.id], function(updateErr) {
                            processedCount++;
                            
                            if (updateErr) {
                                console.error(`Error updating balance for account ${account.account_name}:`, updateErr);
                                results.push({
                                    account_name: account.account_name,
                                    status: 'error', 
                                    error: updateErr.message
                                });
                            } else {
                                console.log(`✅ ${account.account_name}: transaction_activity(${transactionActivity}) = account_balance(${newAccountBalance}) | current_balance = opening(${account.opening_balance}) + account_balance = ${(parseFloat(account.opening_balance || 0) + newAccountBalance).toFixed(2)}`);
                                results.push({
                                    account_name: account.account_name,
                                    account_type: account.account_type,
                                    opening_balance: account.opening_balance,
                                    transaction_activity: transactionActivity,
                                    new_account_balance: newAccountBalance,
                                    status: 'success'
                                });
                            }

                            // Check if all accounts have been processed
                            if (processedCount === accounts.length) {
                                const successCount = results.filter(r => r.status === 'success').length;
                                console.log(`Account balance sync completed: ${successCount}/${accounts.length} accounts updated`);
                                
                                res.json({
                                    status: 'success',
                                    message: `Account balance sync completed`,
                                    processed: processedCount,
                                    successful: successCount,
                                    failed: processedCount - successCount,
                                    results: results
                                });
                            }
                        });
                    }
                });
            });
        });
    }

    reconcileTransaction(req, res) {
        const { id } = req.params;
        const query = 'UPDATE transactions SET is_reconciled = 1 WHERE id = ?';
        
        this.db.run(query, [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ status: 'error', message: 'Transaction not found' });
            }
            res.json({ status: 'success', message: 'Transaction reconciled successfully' });
        });
    }

    bulkImportTransactions(req, res) {
        const { transactions, checkbook_id } = req.body;
        
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return this.sendError(res, 'transactions array is required and must not be empty', 400);
        }
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id is required', 400);
        }

        console.log(`🚀 Starting bulk import of ${transactions.length} transactions for checkbook ${checkbook_id}`);
        
        // Start database transaction for atomicity
        this.db.serialize(() => {
            this.db.run('BEGIN IMMEDIATE', (beginErr) => {
                if (beginErr) {
                    console.error('Error starting transaction:', beginErr);
                    return this.sendError(res, 'Database transaction error', 500);
                }
                
                this.processBulkImport(transactions, checkbook_id, res);
            });
        });
    }

    processBulkImport(transactions, checkbook_id, res) {
        // Validate and prepare transactions
        const validTransactions = [];
        const errors = [];
        const balanceDeltas = {}; // account_id -> net balance change
        
        console.log('📋 Validating transactions...');
        
        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            const rowNum = i + 1;
            
            // Validate required fields
            if (!tx.transaction_type || !tx.transaction_date || !tx.from_account_id || tx.amount === undefined || tx.amount === null) {
                errors.push(`Row ${rowNum}: Missing required fields (transaction_type, transaction_date, from_account_id, amount)`);
                continue;
            }
            
            // Generate unique ID and create fingerprint for deduplication
            const id = 'transaction_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 6);
            const fingerprint = this.createTransactionFingerprint(tx);
            
            validTransactions.push({
                id,
                fingerprint,
                checkbook_id,
                transaction_type: tx.transaction_type,
                transaction_date: tx.transaction_date,
                from_account_id: tx.from_account_id,
                to_account_id: tx.to_account_id || null,
                amount: parseFloat(tx.amount),
                reference_number: tx.reference_number || null,
                description: tx.description || null,
                is_reconciled: tx.is_reconciled || 0
            });
        }
        
        if (errors.length > 0) {
            this.db.run('ROLLBACK');
            return this.sendError(res, `Validation errors: ${errors.join('; ')}`, 400);
        }
        
        console.log(`✅ Validated ${validTransactions.length} transactions`);
        
        // Insert transactions in batch
        this.insertBulkTransactions(validTransactions, checkbook_id, res);
    }

    createTransactionFingerprint(tx) {
        // Create a hash for deduplication based on key fields
        const crypto = require('crypto');
        const data = `${tx.from_account_id}|${tx.to_account_id || 'NULL'}|${tx.transaction_date}|${tx.amount}|${tx.reference_number || ''}|${tx.description || ''}`;
        const fingerprint = crypto.createHash('md5').update(data).digest('hex');
        console.log(`🔐 Generated fingerprint for: ${data} -> ${fingerprint}`);
        return fingerprint;
    }

    insertBulkTransactions(validTransactions, checkbook_id, res) {
        console.log('💾 Checking for existing transactions and inserting new ones...');
        
        // First, get all existing transaction fingerprints for this checkbook
        const getExistingQuery = `
            SELECT from_account_id, to_account_id, transaction_date, amount, reference_number, description 
            FROM transactions 
            WHERE checkbook_id = ?
        `;
        
        this.db.all(getExistingQuery, [checkbook_id], (err, existingTransactions) => {
            if (err) {
                console.error('Error fetching existing transactions:', err);
                this.db.run('ROLLBACK');
                return this.sendError(res, 'Error checking for duplicate transactions', 500);
            }
            
            // Create set of existing fingerprints for fast lookup
            const existingFingerprints = new Set();
            existingTransactions.forEach(tx => {
                const fingerprint = this.createTransactionFingerprint(tx);
                existingFingerprints.add(fingerprint);
            });
            
            console.log(`📋 Found ${existingFingerprints.size} existing transaction fingerprints from ${existingTransactions.length} transactions`);
            
            // Filter out duplicates
            const newTransactions = [];
            let duplicatesSkipped = 0;
            
            validTransactions.forEach(tx => {
                const fingerprint = this.createTransactionFingerprint(tx);
                if (existingFingerprints.has(fingerprint)) {
                    duplicatesSkipped++;
                    console.log(`⏭️ Skipping duplicate transaction: ${tx.transaction_date} ${tx.amount} ${tx.description}`);
                } else {
                    newTransactions.push(tx);
                }
            });
            
            console.log(`📊 Processing ${newTransactions.length} new transactions, ${duplicatesSkipped} duplicates skipped`);
            
            if (newTransactions.length === 0) {
                this.db.run('COMMIT');
                return this.sendSuccess(res, {
                    total_processed: validTransactions.length,
                    inserted: 0,
                    duplicates_skipped: duplicatesSkipped
                }, 'All transactions were duplicates - no new transactions imported');
            }
            
            // Insert only the new transactions
            const insertQuery = `
                INSERT INTO transactions (
                    id, checkbook_id, transaction_type, transaction_date,
                    from_account_id, to_account_id, amount, reference_number,
                    description, is_reconciled, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `;
            
            let completed = 0;
            let inserted = 0;
            const total = newTransactions.length;
            
            newTransactions.forEach((tx, index) => {
                this.db.run(insertQuery, [
                    tx.id, tx.checkbook_id, tx.transaction_type, tx.transaction_date,
                    tx.from_account_id, tx.to_account_id, tx.amount, tx.reference_number,
                    tx.description, tx.is_reconciled
                ], function(err) {
                    completed++;
                    
                    if (err) {
                        console.error(`Error inserting transaction ${index + 1}:`, err);
                    } else {
                        inserted++;
                    }
                    
                    // When all inserts are complete, update balances
                    if (completed === total) {
                        console.log(`✅ Successfully inserted ${inserted} new transactions`);
                        this.updateBalancesForBulkImport(newTransactions, res, {
                            total_processed: validTransactions.length,
                            inserted: inserted,
                            duplicates_skipped: duplicatesSkipped
                        });
                    }
                }.bind(this));
            });
        });
    }

    updateBalancesForBulkImport(insertedTransactions, res, stats) {
        if (insertedTransactions.length === 0) {
            this.db.run('COMMIT');
            return this.sendSuccess(res, stats, 'Bulk import completed (no new transactions)');
        }
        
        console.log('⚖️ Calculating balance updates...');
        
        // Get all unique account IDs to fetch their types
        const accountIds = new Set();
        insertedTransactions.forEach(tx => {
            accountIds.add(tx.from_account_id);
            if (tx.to_account_id) accountIds.add(tx.to_account_id);
        });
        
        const accountIdsArray = Array.from(accountIds);
        const placeholders = accountIdsArray.map(() => '?').join(',');
        const getAccountTypesQuery = `SELECT id, account_type FROM accounts WHERE id IN (${placeholders})`;
        
        this.db.all(getAccountTypesQuery, accountIdsArray, (err, accounts) => {
            if (err) {
                console.error('Error fetching account types:', err);
                this.db.run('ROLLBACK');
                return this.sendError(res, 'Error fetching account types', 500);
            }
            
            // Create account type map
            const accountTypeMap = {};
            accounts.forEach(acc => {
                accountTypeMap[acc.id] = acc.account_type;
            });
            
            // Calculate net balance changes per account
            const balanceDeltas = {};
            
            insertedTransactions.forEach(tx => {
                const fromType = accountTypeMap[tx.from_account_id];
                const toType = tx.to_account_id ? accountTypeMap[tx.to_account_id] : null;
                
                // Determine directions based on transaction type
                let fromDirection, toDirection;
                if (tx.transaction_type === 'debit') {
                    fromDirection = 'OUT';
                    toDirection = 'IN';
                } else { // credit
                    fromDirection = 'IN';
                    toDirection = 'OUT';
                }
                
                // Calculate deltas
                const fromDelta = this.computeDelta(fromType, fromDirection, tx.amount);
                const toDelta = toType ? this.computeDelta(toType, toDirection, tx.amount) : null;
                
                // Accumulate balance changes
                balanceDeltas[tx.from_account_id] = (balanceDeltas[tx.from_account_id] || 0) + fromDelta;
                if (tx.to_account_id && toDelta !== null) {
                    balanceDeltas[tx.to_account_id] = (balanceDeltas[tx.to_account_id] || 0) + toDelta;
                }
            });
            
            // Apply balance updates
            this.applyBulkBalanceUpdates(balanceDeltas, res, stats);
        });
    }

    applyBulkBalanceUpdates(balanceDeltas, res, stats) {
        const accountIds = Object.keys(balanceDeltas);
        
        if (accountIds.length === 0) {
            this.db.run('COMMIT');
            return this.sendSuccess(res, stats, 'Bulk import completed successfully');
        }
        
        console.log(`💰 Updating balances for ${accountIds.length} accounts...`);
        
        let completed = 0;
        let updateErrors = 0;
        
        accountIds.forEach(accountId => {
            const delta = balanceDeltas[accountId];
            const updateQuery = 'UPDATE accounts SET account_balance = account_balance + ? WHERE id = ?';
            
            this.db.run(updateQuery, [delta, accountId], function(err) {
                completed++;
                
                if (err) {
                    console.error(`Error updating balance for account ${accountId}:`, err);
                    updateErrors++;
                }
                
                // When all balance updates are complete
                if (completed === accountIds.length) {
                    if (updateErrors > 0) {
                        console.warn(`⚠️ ${updateErrors} balance update errors occurred`);
                        this.db.run('ROLLBACK');
                        return res.status(500).json({
                            status: 'error',
                            message: `Balance update errors occurred (${updateErrors} accounts)`,
                            data: null
                        });
                    } else {
                        console.log('✅ All balance updates completed successfully');
                        this.db.run('COMMIT');
                        return res.json({
                            status: 'success',
                            message: `Bulk import completed: ${stats.inserted} transactions imported, ${stats.duplicates_skipped} duplicates skipped`,
                            data: stats
                        });
                    }
                }
            }.bind(this));
        });
    }

    // Reconciliation methods
    getReconciliations(req, res) {
        const { checkbook_id, account_id } = req.query;
        
        let query = 'SELECT * FROM reconciliations WHERE 1=1';
        let params = [];

        if (checkbook_id) {
            query += ' AND checkbook_id = ?';
            params.push(checkbook_id);
        }
        if (account_id) {
            query += ' AND account_id = ?';
            params.push(account_id);
        }

        query += ' ORDER BY statement_date DESC';

        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getReconciliationsByAccount(req, res) {
        const { account_id } = req.params;
        const { start_date, end_date } = req.query;
        
        if (!account_id) {
            return this.sendError(res, 'account_id parameter is required', 400);
        }

        let query = 'SELECT * FROM reconciliations WHERE account_id = ?';
        let params = [account_id];

        if (start_date && end_date) {
            query += ' AND statement_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        query += ' ORDER BY statement_date DESC';

        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    createReconciliation(req, res) {
        const {
            checkbook_id, account_id, statement_date,
            statement_balance, reconciled_balance, difference = 0
        } = req.body;
        
        if (!checkbook_id || !account_id || !statement_date || statement_balance === undefined || reconciled_balance === undefined) {
            return this.sendError(res, 'Missing required reconciliation fields', 400);
        }

        const id = 'reconciliation_' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        const query = `
            INSERT INTO reconciliations (
                id, checkbook_id, account_id, statement_date,
                statement_balance, reconciled_balance, difference,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        this.db.run(query, [
            id, checkbook_id, account_id, statement_date,
            statement_balance, reconciled_balance, difference
        ], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.status(201).json({ 
                status: 'success', 
                message: 'Reconciliation created successfully',
                data: { id }
            });
        });
    }

    start(port = 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, 'localhost', () => {
                console.log(`CheckBook Pro API server running on http://localhost:${port}`);
                resolve(this.server);
            }).on('error', reject);
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(resolve);
            } else {
                resolve();
            }
        });
    }

    // Report methods
    getProfitLossReport(req, res) {
        const { checkbook_id } = req.params;
        const { start_date, end_date } = req.query;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        // Get income and expense accounts for P&L with proper balance calculation
        // This correctly handles the transaction_type field and accounting rules:
        // - For expense accounts: DEBIT increases expense, CREDIT decreases expense (refunds)
        // - For income accounts: CREDIT increases income, DEBIT decreases income
        let query = `
            SELECT 
                a.account_name,
                a.account_type,
                a.account_code,
                a.parent_code,
                COALESCE(
                    CASE 
                        WHEN a.account_type = 'expense' THEN
                            -- For expense accounts: DEBIT to expense = positive (increase expense)
                            --                      CREDIT from expense = negative (decrease expense, like refunds)
                            SUM(CASE 
                                WHEN t.transaction_type = 'debit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'credit' AND t.from_account_id = a.id THEN -t.amount
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        WHEN a.account_type = 'income' THEN
                            -- For income accounts: CREDIT to income = positive (increase income)
                            --                     DEBIT from income = negative (decrease income)
                            SUM(CASE 
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'debit' AND t.from_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        ELSE 0
                    END, 0) as balance
            FROM accounts a
            LEFT JOIN transactions t ON (t.from_account_id = a.id OR t.to_account_id = a.id) AND t.checkbook_id = ?
        `;
        
        let params = [checkbook_id];
        
        // Add date filtering if provided
        if (start_date && end_date) {
            query += ` AND t.transaction_date BETWEEN ? AND ?`;
            params.push(start_date, end_date);
        }
        
        query += `
            WHERE a.checkbook_id = ? AND a.is_active = 1 
                AND a.account_type IN ('income', 'expense')
            GROUP BY a.id, a.account_name, a.account_type, a.account_code, a.parent_code
            HAVING ABS(COALESCE(
                    CASE 
                        WHEN a.account_type = 'expense' THEN
                            SUM(CASE 
                                WHEN t.transaction_type = 'debit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'credit' AND t.from_account_id = a.id THEN -t.amount
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        WHEN a.account_type = 'income' THEN
                            SUM(CASE 
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'debit' AND t.from_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        ELSE 0
                    END, 0)) > 0.01
            ORDER BY a.account_type, a.account_name
        `;
        
        params.push(checkbook_id);
        
        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getChartOfAccountsReport(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        // Get all accounts with their balances using synchronized account_balance + opening_balance
        // This uses the maintained account_balance field for performance and consistency
        const query = `
            SELECT 
                a.*,
                -- Use synchronized account_balance + opening_balance for all account types
                CASE 
                    WHEN a.account_type = 'expense' THEN
                        -- Expense accounts: show positive balances as expenses incurred
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    WHEN a.account_type = 'income' THEN
                        -- Income accounts: show positive balances as income earned  
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    WHEN a.account_type = 'asset' THEN
                        -- Asset accounts: show positive balances as assets owned
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    WHEN a.account_type = 'liability' THEN
                        -- Liability accounts: show negative balances to represent debt flow
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    WHEN a.account_type = 'equity' THEN
                        -- Equity accounts: show actual balance including opening
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    ELSE a.account_balance + COALESCE(a.opening_balance, 0)
                END as balance
            FROM accounts a
            WHERE a.checkbook_id = ? AND a.is_active = 1 
            ORDER BY a.account_type, a.account_code, a.account_name
        `;
        
        this.db.all(query, [checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getBalanceSheetReport(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        // Get Balance Sheet accounts using synchronized account_balance + opening_balance  
        // This uses the maintained account_balance field for performance and consistency
        const query = `
            SELECT 
                a.id,
                a.account_code,
                a.parent_code,
                a.account_name,
                a.account_type,
                a.opening_balance,
                a.account_balance,
                a.account_description,
                a.is_active,
                a.created_at,
                a.updated_at,
                -- For Balance Sheet: use synchronized account_balance + opening_balance
                CASE 
                    WHEN a.account_type = 'asset' THEN 
                        -- Assets: show positive balances as assets you own
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    WHEN a.account_type = 'liability' THEN 
                        -- Liabilities: show positive amounts as debts owed
                        -(a.account_balance + COALESCE(a.opening_balance, 0))
                    WHEN a.account_type = 'equity' THEN 
                        -- Equity: show actual balance including opening
                        a.account_balance + COALESCE(a.opening_balance, 0)
                    ELSE a.account_balance + COALESCE(a.opening_balance, 0)
                END as balance
            FROM accounts a
            WHERE a.checkbook_id = ? 
                AND a.is_active = 1 
                AND a.account_type IN ('asset', 'liability', 'equity')
            ORDER BY a.account_type, a.account_code, a.account_name
        `;
        
        this.db.all(query, [checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }


    getTransactionDetailReport(req, res) {
        const { checkbook_id } = req.params;
        const { start_date, end_date, account_id, account_type, parent_code } = req.query;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }


        // Get detailed transaction data for reports
        let query = `
            SELECT 
                t.*,
                fa.account_name as from_account_name,
                ta.account_name as to_account_name,
                fa.account_type as from_account_type,
                ta.account_type as to_account_type
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE t.checkbook_id = ?
        `;
        let params = [checkbook_id];

        if (start_date && end_date) {
            query += ' AND t.transaction_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        if (account_id) {
            query += ' AND (t.from_account_id = ? OR t.to_account_id = ?)';
            params.push(account_id, account_id);
        } else if (account_type) {
            query += ' AND (fa.account_type = ? OR ta.account_type = ?)';
            params.push(account_type, account_type);
        } else if (parent_code) {
            // Filter by parent account code - include transactions where either account has this parent or is the parent itself
            query += ' AND ((fa.parent_code = ? OR fa.account_code = ?) OR (ta.parent_code = ? OR ta.account_code = ?))';
            params.push(parent_code, parent_code, parent_code, parent_code);
        }

        query += ' ORDER BY t.transaction_date DESC, t.id DESC';


        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getAccountHistoryReport(req, res) {
        const { account_id } = req.params;
        const { start_date, end_date, limit = 100 } = req.query;
        
        if (!account_id) {
            return this.sendError(res, 'Account ID is required', 400);
        }
        
        let query = `
            SELECT t.*, 
                   fa.account_name as from_account_name,
                   ta.account_name as to_account_name
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE (t.from_account_id = ? OR t.to_account_id = ?)
        `;
        
        let params = [account_id, account_id];
        
        if (start_date && end_date) {
            query += ' AND t.transaction_date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        
        query += ' ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        this.db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            this.sendSuccess(res, rows);
        });
    }

    getDashboardYTDReport(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        // Calculate YTD income and expenses using same logic as Transaction Detail Report
        // Get current year date range
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const endOfYear = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

        // Query to get YTD income and expense totals using proper accounting rules
        let query = `
            SELECT 
                a.account_type,
                COALESCE(
                    CASE 
                        WHEN a.account_type = 'expense' THEN
                            -- For expense accounts: DEBIT to expense = positive (increase expense)
                            --                      CREDIT from expense = negative (decrease expense, like refunds)
                            SUM(CASE 
                                WHEN t.transaction_type = 'debit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'credit' AND t.from_account_id = a.id THEN -t.amount
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        WHEN a.account_type = 'income' THEN
                            -- For income accounts: CREDIT to income = positive (increase income)
                            --                     DEBIT from income = negative (decrease income)
                            SUM(CASE 
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'debit' AND t.from_account_id = a.id THEN -t.amount

                                ELSE 0 
                            END)
                        ELSE 0
                    END, 0) as ytd_total
            FROM accounts a
            LEFT JOIN transactions t ON (t.from_account_id = a.id OR t.to_account_id = a.id) 
                AND t.checkbook_id = ? 
                AND t.transaction_date BETWEEN ? AND ?
            WHERE a.checkbook_id = ? 
                AND a.is_active = 1 
                AND a.account_type IN ('income', 'expense')
            GROUP BY a.account_type
        `;
        
        this.db.all(query, [checkbook_id, startOfYear, endOfYear, checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            
            // Format the response with YTD income and expense totals
            let ytdIncome = 0;
            let ytdExpenses = 0;
            
            rows.forEach(row => {
                if (row.account_type === 'income') {
                    ytdIncome = Math.max(0, row.ytd_total); // Only positive income
                } else if (row.account_type === 'expense') {
                    ytdExpenses = Math.max(0, row.ytd_total); // Only positive expenses
                }
            });
            
            this.sendSuccess(res, {
                ytdIncome: ytdIncome,
                ytdExpenses: ytdExpenses,
                ytdNet: ytdIncome - ytdExpenses
            });
        });
    }

    getDashboardMTDReport(req, res) {
        const { checkbook_id } = req.params;
        
        if (!checkbook_id) {
            return this.sendError(res, 'checkbook_id parameter is required', 400);
        }

        // Calculate MTD income and expenses using same logic as YTD but for current month
        // Get current month date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // Query to get MTD income and expense totals using proper accounting rules
        let query = `
            SELECT 
                a.account_type,
                COALESCE(
                    CASE 
                        WHEN a.account_type = 'expense' THEN
                            -- For expense accounts: DEBIT to expense = positive (increase expense)
                            --                      CREDIT to/from expense = negative (decrease expense, like refunds)
                            SUM(CASE 
                                WHEN t.transaction_type = 'debit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'credit' AND t.from_account_id = a.id THEN -t.amount
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN -t.amount
                                ELSE 0 
                            END)
                        WHEN a.account_type = 'income' THEN
                            -- For income accounts: CREDIT to income = positive (increase income)
                            --                     DEBIT from income = negative (decrease income)
                            SUM(CASE 
                                WHEN t.transaction_type = 'credit' AND t.to_account_id = a.id THEN t.amount
                                WHEN t.transaction_type = 'debit' AND t.from_account_id = a.id THEN -t.amount
                                ELSE 0 
                            END)
                        ELSE 0
                    END, 0) as mtd_total
            FROM accounts a
            LEFT JOIN transactions t ON (t.from_account_id = a.id OR t.to_account_id = a.id) 
                AND t.checkbook_id = ? 
                AND t.transaction_date BETWEEN ? AND ?
            WHERE a.checkbook_id = ? 
                AND a.is_active = 1 
                AND a.account_type IN ('income', 'expense')
            GROUP BY a.account_type
        `;
        
        this.db.all(query, [checkbook_id, startOfMonth, endOfMonth, checkbook_id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return this.sendError(res, 'Database error', 500);
            }
            
            // Format the response with MTD income and expense totals
            let mtdIncome = 0;
            let mtdExpenses = 0;
            
            rows.forEach(row => {
                if (row.account_type === 'income') {
                    mtdIncome = Math.max(0, row.mtd_total); // Only positive income
                } else if (row.account_type === 'expense') {
                    mtdExpenses = Math.max(0, row.mtd_total); // Only positive expenses
                }
            });
            
            this.sendSuccess(res, {
                mtdIncome: mtdIncome,
                mtdExpenses: mtdExpenses,
                mtdNet: mtdIncome - mtdExpenses
            });
        });
    }

    start(port = 3001) {
        return new Promise((resolve, reject) => {
            // Try the specified port first
            const server = this.app.listen(port, '0.0.0.0', () => {
                console.log(`CheckBook Pro API server running on http://localhost:${port}`);
                resolve(server);
            });
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying port ${port + 1}...`);
                    // Try next port
                    const nextServer = this.app.listen(port + 1, '0.0.0.0', () => {
                        console.log(`CheckBook Pro API server running on http://localhost:${port + 1}`);
                        resolve(nextServer);
                    });
                    
                    nextServer.on('error', (nextErr) => {
                        console.error('Failed to start server on both ports:', nextErr);
                        reject(nextErr);
                    });
                } else {
                    console.error('Server startup error:', err);
                    reject(err);
                }
            });
        });
    }
}

module.exports = CheckBookAPI;