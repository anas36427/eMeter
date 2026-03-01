// Download Invoice Function
function downloadInvoice() {
    // Show downloading message
    showAlert('Downloading invoice...', 'info');
    
    // Simulate download delay
    setTimeout(() => {
        showAlert('Invoice downloaded successfully!', 'success');
    }, 1500);
}

// Payment function (placeholder)
function makePayment() {
    showAlert('Redirecting to payment gateway...', 'info');
    setTimeout(() => {
        window.location.href = 'payment.html';
    }, 1500);
}

// Alert function for consumer portal
function showAlert(message, type = 'success') {
    const iconMap = {
        success: 'check-circle-fill',
        danger: 'exclamation-triangle-fill',
        warning: 'exclamation-circle-fill',
        info: 'info-circle-fill'
    };
    
    const colorMap = {
        success: '#06C270',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert" 
             style="position: fixed; top: 90px; right: 30px; z-index: 9999; min-width: 350px; 
                    border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
                    border-left: 4px solid ${colorMap[type]}; animation: slideIn 0.3s ease;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="bi bi-${iconMap[type]}" style="font-size: 24px; color: ${colorMap[type]};"></i>
                <div>
                    <strong>${message}</strong>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert');
        const lastAlert = alerts[alerts.length - 1];
        if (lastAlert) {
            const bsAlert = bootstrap.Alert.getInstance(lastAlert) || new bootstrap.Alert(lastAlert);
            bsAlert.close();
        }
    }, 5000);
}

// Add Pay Now button functionality
document.addEventListener('DOMContentLoaded', function() {
    const payNowButtons = document.querySelectorAll('.btn-white');
    payNowButtons.forEach(button => {
        if (button.textContent.includes('Pay Now')) {
            button.addEventListener('click', makePayment);
        }
    });
});

// Add slide in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
