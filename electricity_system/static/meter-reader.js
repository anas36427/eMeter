// Helper to prefer data-id selectors but fall back to id
function elBy(name) {
    return document.querySelector('[data-id="' + name + '"]') || document.getElementById(name);
}

// Auto-fill functionality for consumer selection
elBy('consumerSelect')?.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const meterNumber = selectedOption.getAttribute('data-meter');
    const previousReading = selectedOption.getAttribute('data-previous');
    
    const meterEl = elBy('meterNumber');
    const prevEl = elBy('previousReading');
    if (meterEl) meterEl.value = meterNumber || '';
    if (prevEl) prevEl.value = previousReading || '';
    
    // Trigger calculation if current reading exists
    calculateConsumption();
});

// Calculate consumption in real-time
function calculateConsumption() {
    const previousReading = parseFloat(elBy('previousReading')?.value) || 0;
    const currentReading = parseFloat(elBy('currentReading')?.value) || 0;
    
    if (previousReading && currentReading && currentReading >= previousReading) {
        const consumed = currentReading - previousReading;
        
        // Show summary
        const summary = elBy('consumptionSummary');
        if (summary) {
            summary.style.display = 'block';
            const sPrev = elBy('summaryPrevious');
            const sCurr = elBy('summaryCurrent');
            const sCons = elBy('summaryConsumed');
            if (sPrev) sPrev.textContent = previousReading + ' kWh';
            if (sCurr) sCurr.textContent = currentReading + ' kWh';
            if (sCons) sCons.textContent = consumed + ' kWh';
        }
    } else {
        const summary = elBy('consumptionSummary');
        if (summary) {
            summary.style.display = 'none';
        }
    }
}

elBy('currentReading')?.addEventListener('input', calculateConsumption);

// Set today's date by default
const today = new Date().toISOString().split('T')[0];
const readingDateInput = elBy('readingDate');
if (readingDateInput) {
    readingDateInput.value = today;
    readingDateInput.max = today; // Prevent future dates
}

// Set current time by default
const now = new Date();
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const readingTimeInput = elBy('readingTime');
if (readingTimeInput) {
    readingTimeInput.value = `${hours}:${minutes}`;
}

// Form submission for meter reading
elBy('submitReadingForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (this.checkValidity()) {
        // Validate current reading is greater than previous
        const previousReading = parseFloat(elBy('previousReading').value);
        const currentReading = parseFloat(elBy('currentReading').value);
        
        if (currentReading < previousReading) {
            showAlert('Error: Current reading must be greater than or equal to previous reading', 'danger');
            return;
        }
        
        // Show success message
        showAlert('Reading submitted successfully!', 'success');
        
        // Reset form after short delay
        setTimeout(() => {
            this.reset();
            const summaryEl = elBy('consumptionSummary');
            if (summaryEl) summaryEl.style.display = 'none';
            
            // Reset date and time to defaults
            if (readingDateInput) readingDateInput.value = today;
            if (readingTimeInput) readingTimeInput.value = `${hours}:${minutes}`;
        }, 1500);
    } else {
        this.classList.add('was-validated');
    }
});

// Alert function
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
                    border-left: 4px solid ${colorMap[type]};">
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
        const alert = document.querySelectorAll('.alert')[document.querySelectorAll('.alert').length - 1];
        if (alert) {
            const bsAlert = bootstrap.Alert.getInstance(alert) || new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

// File upload preview
elBy('meterPhoto')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // Convert to MB
        if (fileSize > 5) {
            showAlert('File size exceeds 5MB limit', 'warning');
            this.value = '';
            return;
        }
        
        const uploadArea = this.closest('.file-upload-area');
        const hint = uploadArea.querySelector('.file-upload-hint');
        hint.innerHTML = `
            <i class="bi bi-check-circle-fill" style="color: var(--success);"></i>
            <p>${file.name}</p>
            <span>${fileSize} MB</span>
        `;
    }
});
