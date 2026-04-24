/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                light: {
                    bg: '#f8fafc',
                    card: '#ffffff',
                    border: '#e5e7eb',
                    primary: '#2563eb',
                    accent: '#0ea5e9',
                    text: '#0f172a',
                    secondary: '#64748b',
                    muted: '#f1f5f9',
                },
                dark: {
                    bg: '#0b1220',
                    card: '#111827',
                    border: '#1f2937',
                    primary: '#3b82f6',
                    accent: '#22d3ee',
                    text: '#e5e7eb',
                    secondary: '#9ca3af',
                    muted: '#1a2535',
                },
            },
            fontFamily: {
                heading: ['"Open Sans"', 'Helvetica', 'Arial', 'sans-serif'],
                body: ['"Open Sans"', 'Helvetica', 'Arial', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}