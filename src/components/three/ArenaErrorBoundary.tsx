import { Component, type ReactNode } from "react";

/**
 * Renders `fallback` (default null) on any throw from its children (WebGL
 * unavailable, GLB/asset 404, three.js runtime error). The Fight Club battle
 * view keeps the 2D HP cards below the arena, so a failed 3D canvas just falls
 * back to those instead of leaving a dead box; the Explore viewer passes the
 * old MP4 as the fallback.
 *
 * `resetKey`: when it changes (e.g. browsing to a different Fini), a previous
 * failure is cleared and the children get a fresh attempt — without this, one
 * missing GLB would lock the boundary into the fallback forever.
 */
export class ArenaErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; resetKey?: unknown },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[arena3d] render failed, using fallback:", error);
  }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }
  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
