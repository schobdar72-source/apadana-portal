/** @type {import('next').NextConfig} */
const testDir = process.env.ITSM_TEST_DIST_DIR;
if (testDir && !/^\.next-itsm-acceptance-[a-f0-9]{12}$/.test(testDir)) throw new Error('Invalid isolated ITSM build directory');
const nextConfig = { reactStrictMode: true, ...(testDir ? { distDir: testDir } : {}) };
export default nextConfig;
