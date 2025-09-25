// Enhanced Trade History Handler
function initTradeHistory() {
    const tradesList = document.getElementById('tradesList');
    if (!tradesList) return;

    // Get user session and trades
    const session = Store.getSession();
    if (!session) return;

    const trades = Store.getTrades(session.email === 'demo@primeedge.com' ? 'demo' : session.email);
    
    // Setup filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateTradeList(trades, btn.dataset.filter);
        });
    });

    // Initial render
    updateTradeList(trades, 'all');
}

function updateTradeList(trades, filter) {
    const tradesList = document.getElementById('tradesList');
    if (!trades || !tradesList) return;

    // Filter trades if needed
    const filteredTrades = filter === 'all' ? 
        trades : 
        trades.filter(trade => trade.type === filter);

    // Sort trades by timestamp (newest first)
    filteredTrades.sort((a, b) => b.timestamp - a.timestamp);

    // Clear current list
    tradesList.innerHTML = '';

    if (filteredTrades.length === 0) {
        tradesList.innerHTML = `
            <div class="no-trades">
                <div class="no-trades-icon">📊</div>
                <div class="no-trades-text">No trades to display</div>
            </div>
        `;
        return;
    }

    // Render trades
    filteredTrades.forEach(trade => {
        const tradeEl = document.createElement('div');
        tradeEl.className = 'trade-item';
        
        const profit = trade.result === 'win' ? trade.amount * 0.95 : -trade.amount;
        
        tradeEl.innerHTML = `
            <div class="trade-info">
                <div class="trade-details-primary">
                    <div class="trade-pair">${trade.pair} • ${trade.type.toUpperCase()}</div>
                    <div class="trade-amount">$${trade.amount.toFixed(2)}</div>
                    <div class="trade-sl-tp">SL: $${trade.stopLoss.toFixed(2)} TP: $${trade.takeProfit.toFixed(2)}</div>
                </div>
                <div class="trade-details-secondary">
                    <div class="trade-time">${trade.duration}m • ${new Date(trade.timestamp).toLocaleString()}</div>
                    <div class="trade-status">
                        <span class="trade-result ${trade.result}">${trade.result === 'win' ? 'Won' : 'Lost'}</span>
                        <span class="trade-settled">Settled</span>
                    </div>
                </div>
            </div>
        `;
        
        tradesList.appendChild(tradeEl);
    });
}

// Initialize trade history when document is loaded
document.addEventListener('DOMContentLoaded', initTradeHistory);