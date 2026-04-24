'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
    // 1. Change the initial fallback state to 'dark'
    const [theme, setTheme] = useState('dark')

    useEffect(() => {
        // 2. Check if the user already saved a preference
        const stored = localStorage.getItem('sc-bhiot-theme')

        if (stored) {
            setTheme(stored)
        } else {
            // 3. If no saved preference, force 'dark' as the default
            setTheme('dark')
        }
    }, [])

    useEffect(() => {
        // Apply the dark class to the HTML tag based on state
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        // Save user's preference for next time
        localStorage.setItem('sc-bhiot-theme', theme)
    }, [theme])

    const toggleTheme = () =>
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)