import './globals.css'
import { ThemeProvider } from '../components/ThemeProvider'
import { Web3Provider } from '../context/Web3Context'
import SplashScreen from '../components/SplashScreen'

export const metadata = {
    title: 'B-IoT - Blockchain Healthcare Platform',
    description: 'Secure, transparent IoT-based healthcare data management on Ethereum',
}

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                          try {
                            var t = localStorage.getItem('sc-bhiot-theme');
                            // If the user explicitly chose 'light', leave it alone. 
                            // Otherwise (if 'dark' or if they are a first-time visitor), make it dark!
                            if (t === 'dark' || !t) {
                              document.documentElement.classList.add('dark');
                            }
                          } catch(e) {}
                        `,
                    }}
                />
            </head>
            <body>
                <ThemeProvider>
                    <Web3Provider>
                        <SplashScreen />
                        {children}
                    </Web3Provider>
                </ThemeProvider>
            </body>
        </html>
    )
}