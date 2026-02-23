// Sidebar Toggle
document.getElementById('sidebarToggle')?.addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
});

// Generate Bill Function
function generateBill() {
    // Show success alert
    const alertHtml = `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="position: fixed; top: 90px; right: 30px; z-index: 9999; min-width: 350px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-left: 4px solid #06C270;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="bi bi-check-circle-fill" style="font-size: 24px; color: #06C270;"></i>
                <div>
                    <strong>Bill Generated Successfully!</strong>
                    <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Invoice has been sent to the consumer.</p>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('generateBillModal'));
    modal.hide();
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

// Form Validation
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (form.checkValidity()) {
                // Form is valid
                if (form.id === 'generateBillForm') {
                    generateBill();
                }
            } else {
                // Show validation errors
                form.classList.add('was-validated');
            }
        });
    });
});

// Real-time Bill Calculation
const currentReadingInput = document.querySelector('input[type="number"][value="1700"]');
const previousReadingInput = document.querySelector('input[type="number"][value="1250"]');
const rateInput = document.querySelector('input[type="number"][step="0.01"]');

function calculateBill() {
    if (!currentReadingInput || !previousReadingInput || !rateInput) return;
    
    const current = parseFloat(currentReadingInput.value) || 0;
    const previous = parseFloat(previousReadingInput.value) || 0;
    const rate = parseFloat(rateInput.value) || 0;
    
    const unitsConsumed = Math.max(0, current - previous);
    const energyCharges = unitsConsumed * rate;
    const fixedCharges = 8.00;
    const totalAmount = energyCharges + fixedCharges;
    
    // Update display
    const calcSummary = document.querySelector('.calculation-summary');
    if (calcSummary) {
        calcSummary.innerHTML = `
            <div class="calc-row">
                <span>Units Consumed:</span>
                <strong>${unitsConsumed} kWh</strong>
            </div>
            <div class="calc-row">
                <span>Energy Charges:</span>
                <strong>$${energyCharges.toFixed(2)}</strong>
            </div>
            <div class="calc-row">
                <span>Fixed Charges:</span>
                <strong>$${fixedCharges.toFixed(2)}</strong>
            </div>
            <div class="calc-row total">
                <span>Total Amount:</span>
                <strong>$${totalAmount.toFixed(2)}</strong>
            </div>
        `;
    }
}

if (currentReadingInput) {
    currentReadingInput.addEventListener('input', calculateBill);
}

if (rateInput) {
    rateInput.addEventListener('input', calculateBill);
}

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Table row click handler (optional)
document.querySelectorAll('.custom-table tbody tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', function(e) {
        if (!e.target.closest('.btn-action')) {
            // Handle row click (e.g., navigate to detail page)
            console.log('Row clicked');
        }
    });
});

// Auto-dismiss alerts
setTimeout(() => {
    document.querySelectorAll('.alert').forEach(alert => {
        if (alert.querySelector('.btn-close')) {
            const closeBtn = alert.querySelector('.btn-close');
            closeBtn.click();
        }
    });
}, 5000);
