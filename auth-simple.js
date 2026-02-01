// ============================================
// SIMPLIFIED AUTH INITIALIZATION
// ============================================

console.log('🚀 Auth script loading...');

// Wait for page to fully load
window.addEventListener('load', function() {
    console.log('✅ Page loaded, initializing auth...');
    
    // AUTH MODAL DISABLED - Won't auto-show anymore
    // Can be re-enabled later as an enhancement
    // setTimeout(() => {
    //     const authModal = document.getElementById('authModal');
    //     if (authModal) {
    //         authModal.classList.add('active');
    //         console.log('📋 Auth modal shown');
    //     }
    // }, 2000);
    
    // Setup signup button
    const signupBtn = document.getElementById('signupBtn');
    console.log('🔍 Signup button found:', !!signupBtn);
    
    if (signupBtn) {
        signupBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🔵 SIGNUP BUTTON CLICKED!');
            
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const childName = document.getElementById('signupName').value;
            const childAge = document.getElementById('signupAge').value;
            
            console.log('📝 Form data:', { email, childName, childAge, passwordLength: password.length });
            
            // Validation
            if (!email || !password || !childName || !childAge) {
                alert('Please fill in all fields');
                console.log('❌ Validation failed: empty fields');
                return;
            }
            
            if (password.length < 6) {
                alert('Password must be at least 6 characters');
                console.log('❌ Validation failed: password too short');
                return;
            }
            
            console.log('✅ Validation passed, calling Supabase...');
            
            try {
                // Get Supabase client
                const { createClient } = supabase;
                const supabaseClient = createClient(
                    'https://tybeiukfsuzwdvjwavtp.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5YmVpdWtmc3V6d2R2andhdnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjE0ODUsImV4cCI6MjA4NTA5NzQ4NX0.1DI8_CQpxNdtxhhq9-dAxObFxxD-5xan0MvUzNuxd-Y'
                );
                
                console.log('📡 Calling Supabase signUp...');
                
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: childName,
                            age: parseInt(childAge)
                        }
                    }
                });
                
                console.log('📡 Supabase response:', { 
                    hasData: !!data, 
                    hasUser: !!data?.user,
                    error: error?.message 
                });
                
                if (error) {
                    console.error('❌ Supabase error:', error);
                    alert('Signup error: ' + error.message);
                    return;
                }
                
                if (data.user) {
                    console.log('✅ User created:', data.user.id);
                    
                    // Create profile
                    const { error: profileError } = await supabaseClient
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            email: email,
                            full_name: childName,
                            age: parseInt(childAge)
                        });
                    
                    if (profileError) {
                        console.error('⚠️ Profile error:', profileError);
                    } else {
                        console.log('✅ Profile created');
                    }
                    
                    // Close modal
                    const authModal = document.getElementById('authModal');
                    if (authModal) {
                        authModal.classList.remove('active');
                    }
                    
                    alert(`Welcome, ${childName}! Account created successfully! 🎉`);
                    console.log('🎉 Signup complete!');
                }
                
            } catch (err) {
                console.error('❌ Caught error:', err);
                alert('Error: ' + err.message);
            }
        });
        
        console.log('✅ Signup button listener attached');
    }
    
    // Setup login button
    const loginBtn = document.getElementById('loginBtn');
    console.log('🔍 Login button found:', !!loginBtn);
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🔵 LOGIN BUTTON CLICKED!');
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                alert('Please enter email and password');
                return;
            }
            
            try {
                const { createClient } = supabase;
                const supabaseClient = createClient(
                    'https://tybeiukfsuzwdvjwavtp.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5YmVpdWtmc3V6d2R2andhdnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjE0ODUsImV4cCI6MjA4NTA5NzQ4NX0.1DI8_CQpxNdtxhhq9-dAxObFxxD-5xan0MvUzNuxd-Y'
                );
                
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    alert('Login error: ' + error.message);
                    return;
                }
                
                if (data.user) {
                    const authModal = document.getElementById('authModal');
                    if (authModal) {
                        authModal.classList.remove('active');
                    }
                    alert(`Welcome back!`);
                }
                
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
        
        console.log('✅ Login button listener attached');
    }
    
    // Close button
    const closeBtn = document.getElementById('closeAuthModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const authModal = document.getElementById('authModal');
            if (authModal) {
                authModal.classList.remove('active');
            }
        });
        console.log('✅ Close button listener attached');
    }
    
    // Toggle between login/signup
    const showSignup = document.getElementById('showSignup');
    const showLogin = document.getElementById('showLogin');
    
    if (showSignup) {
        showSignup.addEventListener('click', function() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('signupForm').classList.remove('hidden');
        });
    }
    
    if (showLogin) {
        showLogin.addEventListener('click', function() {
            document.getElementById('signupForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        });
    }
    
    console.log('✅ All auth handlers initialized');
});

console.log('📄 Auth script loaded');
