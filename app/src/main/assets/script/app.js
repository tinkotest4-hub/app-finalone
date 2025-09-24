// Toast notification handling
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Password visibility toggle
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input');
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
    });
});

// Login form handling
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const checkbox = document.querySelector('.checkbox-group input[type="checkbox"]');
    
    // Validate robot check
    if (!checkbox.checked) {
        showToast("Please verify that you're not a robot");
        return;
    }

    // Demo account validation
    if ((email === 'demo@primeedge.com' && password === 'demo123') || 
        (email === 'admin@primeedge.com' && password === 'admin123')) {
        
        // Store user session
        sessionStorage.setItem('user', JSON.stringify({
            email: email,
            role: email.startsWith('admin') ? 'admin' : 'user'
        }));
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } else {
        showToast('Invalid email or password');
    }
});
