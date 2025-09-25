/* Auth check helper */
function checkAdminAccess(requiredType) {
    const userType = sessionStorage.getItem('userType');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    
    if (!isLoggedIn || !userType) {
        navigate('login.html');
        return false;
    }
    
    if (userType !== requiredType) {
        alert('Access denied. Insufficient privileges.');
        navigate('login.html');
        return false;
    }
    
    return true;
}