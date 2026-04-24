/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    turbopack: {
        root: __dirname,
    },
    allowedDevOrigins: ['172.26.240.1'],
}

module.exports = nextConfig