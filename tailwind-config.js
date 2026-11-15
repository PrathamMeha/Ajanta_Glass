// Moved out of index.html so the Content-Security-Policy does not need 'unsafe-inline' for scripts.
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Space Grotesk', 'sans-serif'],
                syne: ['Syne', 'sans-serif'],
            },
            colors: {
                luxuryDark: '#050505',
                luxurySlate: '#0F172A',
                luxuryAccent: '#00B8D9',
            }
        }
    }
};
