/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                aws: {
                    nav: '#232f3e',
                    dark: '#161e2d',
                    light: '#f2f3f3',
                    orange: '#ff9900',
                    blue: '#0073bb',
                }
            }
        },
    },
    plugins: [],
}
