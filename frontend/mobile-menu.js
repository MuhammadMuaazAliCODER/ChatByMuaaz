
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
   
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', function() {
            toggleSidebar();
        });
    }
    
   
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            closeSidebar();
        });
    }
    
   
    function attachChatItemHandlers() {
        const chatItems = document.querySelectorAll('.chat-item, .friend-item');
        chatItems.forEach(item => {
            
            item.removeEventListener('click', handleChatItemClick);
            
            item.addEventListener('click', handleChatItemClick);
        });
    }
    
    
    function handleChatItemClick(e) {
        if (window.innerWidth <= 768) {
            
            setTimeout(() => {
                closeSidebar();
            }, 100);
        }
    }
    
    
    attachChatItemHandlers();
    
    
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                attachChatItemHandlers();
            }
        });
    });
    
    
    const chatsList = document.getElementById('chatsList');
    const friendsList = document.getElementById('friendsList');
    
    if (chatsList) {
        observer.observe(chatsList, { childList: true, subtree: true });
    }
    
    if (friendsList) {
        observer.observe(friendsList, { childList: true, subtree: true });
    }
    
    
    document.addEventListener('click', function(e) {
        
        if (window.innerWidth <= 768) {
            const target = e.target;
            
            
            
            
            
            if (target.closest('.search-results') && 
                (target.classList.contains('btn-primary') || 
                 target.classList.contains('btn-secondary') ||
                 target.tagName === 'BUTTON')) {
                
                setTimeout(() => {
                    closeSidebar();
                }, 150);
            }
        }
    });
    
    
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768) {
                
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                hamburgerBtn.classList.remove('active');
            }
        }, 250);
    });
    
    
    function preventBodyScroll(prevent) {
        if (prevent) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
    
    function toggleSidebar() {
        const isActive = sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        hamburgerBtn.classList.toggle('active');
        
        if (window.innerWidth <= 768) {
            preventBodyScroll(isActive);
        }
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        
        if (window.innerWidth <= 768) {
            preventBodyScroll(false);
        }
    }
    
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    if (sidebar) {
        sidebar.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        sidebar.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }
    
    function handleSwipe() {
        
        if (touchStartX - touchEndX > 50) {
            closeSidebar();
        }
    }
    
    
    window.closeMobileSidebar = closeSidebar;
});