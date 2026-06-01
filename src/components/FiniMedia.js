import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { FiniAvatar } from "./FiniAvatar";
/**
 * Shows a Fini's *actual* wallet artwork: the animated mp4 first (small, streams
 * fast), falling back to the gif, then to the cute SVG face. Each media type
 * walks an ordered list of Arweave gateways on error, so a single slow/404
 * gateway never blanks the card.
 *
 * The SVG face is shown underneath as an instant placeholder until real media
 * paints, so the grid never flashes empty.
 */
export function FiniMedia(props) {
    const { artwork, family, mood, animate = true } = props;
    // Candidate source lists (mp4 preferred, then gif).
    const videoSrcs = artwork.animationUrls ?? [];
    const imgSrcs = artwork.imageUrls ?? [];
    const [videoIdx, setVideoIdx] = useState(0);
    const [imgIdx, setImgIdx] = useState(0);
    const [videoDead, setVideoDead] = useState(videoSrcs.length === 0);
    const [imgDead, setImgDead] = useState(imgSrcs.length === 0);
    const [loaded, setLoaded] = useState(false);
    // Reset when the artwork changes (different token).
    useEffect(() => {
        setVideoIdx(0);
        setImgIdx(0);
        setVideoDead(videoSrcs.length === 0);
        setImgDead(imgSrcs.length === 0);
        setLoaded(false);
    }, [artwork.imageUrl, artwork.animationUrl, videoSrcs.length, imgSrcs.length]);
    const videoRef = useRef(null);
    // Imperatively mute + (un)play. React's `muted` prop has a long-standing race
    // where it isn't applied before the autoplay attempt, which silently blocks
    // muted autoplay — so we force it on the element and (re)trigger play here.
    const kick = (el) => {
        if (!el)
            return;
        el.muted = true;
        el.defaultMuted = true;
        if (animate)
            void el.play().catch(() => { });
        else
            el.pause();
    };
    useEffect(() => {
        kick(videoRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animate, videoIdx, loaded]);
    const showVideo = !videoDead && videoSrcs.length > 0;
    const showImg = videoDead && !imgDead && imgSrcs.length > 0;
    return (_jsxs("div", { className: `relative w-full h-full ${props.className ?? ""}`, children: [!loaded && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx(FiniAvatar, { family: family, mood: mood, size: 56 }) })), showVideo && (_jsx("video", { ref: videoRef, src: videoSrcs[videoIdx], muted: true, loop: true, playsInline: true, autoPlay: true, preload: "auto", onLoadedData: (e) => {
                    setLoaded(true);
                    kick(e.currentTarget);
                }, onCanPlay: (e) => kick(e.currentTarget), onError: () => {
                    if (videoIdx + 1 < videoSrcs.length)
                        setVideoIdx((i) => i + 1);
                    else
                        setVideoDead(true);
                }, className: "w-full h-full object-contain", style: { opacity: loaded ? 1 : 0, transition: "opacity 0.2s" } }, videoSrcs[videoIdx])), showImg && (_jsx("img", { src: imgSrcs[imgIdx], alt: "", loading: "lazy", onLoad: () => setLoaded(true), onError: () => {
                    if (imgIdx + 1 < imgSrcs.length)
                        setImgIdx((i) => i + 1);
                    else
                        setImgDead(true);
                }, className: "w-full h-full object-contain", style: { opacity: loaded ? 1 : 0, transition: "opacity 0.2s" } }, imgSrcs[imgIdx]))] }));
}
