import { Component, type ReactNode } from "react";

/**
 * Renders `null` on any throw from its children (WebGL unavailable, GLB/asset
 * 404, three.js runtime error). The Fight Club battle view keeps the 2D HP
 * cards below the arena, so a failed 3D canvas just falls back to those instead
 * of leaving a dead box.
 */
export class ArenaErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[arena3d] render failed, falling back to 2D cards:", error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
