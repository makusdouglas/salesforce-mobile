// 017-revenue-dashboard — re-export so revenue feature folders import
// `useViewport` from a stable path within their own folder. Logic
// continues to live with feature 013's orders module.

export { useViewport, type Viewport } from '@/features/orders/hooks/useViewport';
