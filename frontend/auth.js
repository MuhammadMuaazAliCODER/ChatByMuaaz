// Authentication Logic
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = getToken();
    if (token) {
        verifyAndRedirect();
    }

    // Get form elements
    const loginForm = document.getElementById('login');
    const registerForm = document.getElementById('register');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegister');
    const showLoginBtn = document.getElementById('showLogin');

    // Toggle between login and register forms
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = 'block';
        clearErrors();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormDiv.style.display = 'none';
        loginFormDiv.style.display = 'block';
        clearErrors();
    });

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');

        if (!username || !password) {
            showError(errorElement, 'Please fill in all fields');
            return;
        }

        try {
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            const data = await apiRequest(ENDPOINTS.LOGIN, {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            setToken(data.token);
            setUser(data.user);

            // Redirect to chat page
            window.location.href = 'chat.html';
        } catch (error) {
            showError(errorElement, error.message || 'Login failed');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    // Handle register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value.trim();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const errorElement = document.getElementById('register-error');

        if (!name || !username || !email || !password) {
            showError(errorElement, 'Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            showError(errorElement, 'Password must be at least 6 characters');
            return;
        }

        if (!isValidEmail(email)) {
            showError(errorElement, 'Please enter a valid email');
            return;
        }

        try {
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            const data = await apiRequest(ENDPOINTS.REGISTER, {
                method: 'POST',
                body: JSON.stringify({ name, username, email, password }),
            });

            setToken(data.token);
            setUser(data.user);

            // Redirect to chat page
            window.location.href = 'chat.html';
        } catch (error) {
            showError(errorElement, error.message || 'Registration failed');
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });

    // Clear errors on input
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', clearErrors);
    });
});

// Verify token and redirect if valid
async function verifyAndRedirect() {
    try {
        await apiRequest(ENDPOINTS.VERIFY);
        window.location.href = 'chat.html';
    } catch (error) {
        removeToken();
        removeUser();
    }
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

// Clear all error messages
function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}