// API Helper Functions
async function apiCall(endpoint, optionsOrMethod = {}, bodyData = null) {
    try {
        // Support multiple call formats:
        // apiCall('/path', 'POST', data) - legacy format
        // apiCall('/path', { method: 'POST', body: data }) - new format
        let options = {};
        if (typeof optionsOrMethod === 'string') {
            options = { method: optionsOrMethod };
            if (bodyData) {
                options.body = bodyData;
            }
        } else {
            options = optionsOrMethod || {};
        }
        
        // Add cache-busting parameter for GET requests to ensure fresh data
        const method = options.method || 'GET';
        const cacheBuster = method === 'GET' ? `${endpoint.includes('?') ? '&' : '?'}_cb=${Date.now()}` : '';
        
        const url = `${API_BASE_URL}${endpoint}${cacheBuster}`;
        
        // Ensure body is properly serialized for POST/PUT requests
        const requestOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        if (options.body && (method === 'POST' || method === 'PUT')) {
            requestOptions.body = JSON.stringify(options.body);
        } else if (options.body) {
            requestOptions.body = options.body;
        }
        
        const response = await fetch(url, requestOptions);
        
        let responseText = await response.text();
        // console.log('Raw API response:', responseText);
        
        // Handle PHP warnings/errors that appear before JSON
        if (responseText.includes('<br />')) {
            const jsonStart = responseText.indexOf('{');
            if (jsonStart > 0) {
                responseText = responseText.substring(jsonStart);
                // console.log('Cleaned JSON:', responseText);
            }
        }
        
        const data = JSON.parse(responseText);
        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        // Parse date as local date to avoid timezone issues
        const parts = dateString.split('-');
        if (parts.length === 3) {
            // Create local date: new Date(year, month-1, day)
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-based
            const day = parseInt(parts[2]);
            const date = new Date(year, month, day);
            
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        
        // Fallback to original method for other date formats
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.warn('Date formatting error:', error, 'for date:', dateString);
        return 'Invalid Date';
    }
}

function getAccountIcon(accountName, accountType) {
    const name = accountName.toLowerCase();
    if (name.includes('wells') || name.includes('bank')) {
        return '🏦'; // Bank icon
    }
    if (name.includes('cash')) {
        return '💰'; // Wallet icon
    }
    if (name.includes('investment') || name.includes('brokerage')) {
        return '📈'; // Chart icon
    }
    if (name.includes('credit') || name.includes('card')) {
        return '💳'; // Credit card icon
    }
    if (name.includes('home') || name.includes('mortgage')) {
        return '🏠'; // House icon
    }
    if (name.includes('car') || name.includes('vehicle')) {
        return '🚘'; // House icon
    }
    if (name.includes('property') || name.includes('chair')) {
        return '🪑'; // House icon
    }


    
    // Fallback by account type
    const icons = {
        'asset': '💰',
        'liability': '💳',
        'income': '💵',
        'expense': '💸',
        'equity': '🏦'
    };
    return icons[accountType] || '📊';
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    }
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
    }
}


