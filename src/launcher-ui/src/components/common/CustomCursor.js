import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';

const CORNER_SIZE = 8; // px
const PADDING = 8; // px
const MIN_CORNER_GAP = 8; // px (distance from center to start of each corner)
const ANIMATION_DURATION = 200; // ms
const CURSOR_THICKNESS = 3; // px (center plus thickness)
const CORNER_THICKNESS = 5; // px (corner stroke thickness)

// Memoized corner component to prevent unnecessary re-renders
const Corner = memo(({ index, color }) => (
  <svg width={CORNER_SIZE} height={CORNER_SIZE} style={{ display: 'block' }}>
    {index === 0 && (
      <polyline
        points={`0,${CORNER_SIZE} 0,0 ${CORNER_SIZE},0`}
        stroke={color}
        strokeWidth={CORNER_THICKNESS}
        fill="none"
      />
    )}
    {index === 1 && (
      <polyline
        points={`${CORNER_SIZE},${CORNER_SIZE} ${CORNER_SIZE},0 0,0`}
        stroke={color}
        strokeWidth={CORNER_THICKNESS}
        fill="none"
      />
    )}
    {index === 2 && (
      <polyline
        points={`${CORNER_SIZE},0 ${CORNER_SIZE},${CORNER_SIZE} 0,${CORNER_SIZE}`}
        stroke={color}
        strokeWidth={CORNER_THICKNESS}
        fill="none"
      />
    )}
    {index === 3 && (
      <polyline
        points={`0,0 0,${CORNER_SIZE} ${CORNER_SIZE},${CORNER_SIZE}`}
        stroke={color}
        strokeWidth={CORNER_THICKNESS}
        fill="none"
      />
    )}
  </svg>
));

const CustomCursor = () => {
  const [hoveredRect, setHoveredRect] = useState(null);
  const [visible, setVisible] = useState(true);
  const svgRef = useRef(null);
  const cornerRef1 = useRef(null);
  const cornerRef2 = useRef(null);
  const cornerRef3 = useRef(null);
  const cornerRef4 = useRef(null);
  const cornerRefs = useMemo(() => [cornerRef1, cornerRef2, cornerRef3, cornerRef4], []);
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const targetMouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const rafRef = useRef(null);
  const containerRef = useRef(null);
  const cursorColor = '#fff';
  const hoveredElement = useRef(null);

  // Memoized event handlers
  const handleMouseMove = useCallback(e => {
    targetMouse.current.x = e.clientX;
    targetMouse.current.y = e.clientY;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    setVisible(!(el && el.closest('.app-drag-region')));
  }, []);

  const handleMouseOut = useCallback(e => {
    if (!e.relatedTarget || !containerRef.current?.contains(e.relatedTarget)) {
      setVisible(false);
    }
  }, []);

  const handleMouseOver = useCallback(e => {
    if (!e.relatedTarget || !containerRef.current?.contains(e.relatedTarget)) {
      setVisible(true);
    }
  }, []);

  const handlePointerOver = useCallback(e => {
    const target =
      e.target.closest('.toast-hover') ||
      e.target.closest('.cursor-hover') ||
      (e.target.tagName === 'BUTTON'
        ? e.target
        : e.target.closest('button') ||
          e.target.closest('.MuiButton-root') ||
          e.target.closest('.image-button') ||
          e.target.closest('.MuiListItem-root') ||
          e.target.closest('.hover-effect') ||
          e.target.closest('.MuiInputBase-input') ||
          e.target.closest('.featured-progress-bars') ||
          e.target.closest('.MuiChip-root') ||
          e.target.closest('.view-on-github-link') ||
          e.target.closest('.download-link') ||
          e.target.closest('.settings-section-content') ||
          e.target.closest('.MuiButtonBase-root') ||
          e.target.closest('.MuiMenuItem-root') ||
          e.target.closest('.MuiAvatar-root'));

    if (target) {
      hoveredElement.current = target;
      const rect = target.getBoundingClientRect();
      const minSize = 2 * MIN_CORNER_GAP + CORNER_SIZE;
      const width = Math.max(rect.width + 2 * PADDING, minSize);
      const height = Math.max(rect.height + 2 * PADDING, minSize);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setHoveredRect({
        left: centerX - width / 2,
        top: centerY - height / 2,
        right: centerX + width / 2,
        bottom: centerY + height / 2,
        width,
        height,
      });
    } else {
      hoveredElement.current = null;
      setHoveredRect(null);
    }
  }, []);

  // Mouse movement tracking
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [handleMouseMove, handleMouseOut, handleMouseOver]);

  // Hover detection
  useEffect(() => {
    window.addEventListener('mouseover', handlePointerOver);
    return () => window.removeEventListener('mouseover', handlePointerOver);
  }, [handlePointerOver]);

  // Animation loop for cursor and corners
  useEffect(() => {
    function animate() {
      // Instantly follow the mouse for the center part
      mouse.current.x = targetMouse.current.x;
      mouse.current.y = targetMouse.current.y;

      // If hovering an element, update hoveredRect every frame
      if (hoveredElement.current) {
        // Check if the element is still in the DOM
        if (!document.body.contains(hoveredElement.current)) {
          hoveredElement.current = null;
          setHoveredRect(null);
        } else {
          const target = hoveredElement.current;
          const rect = target.getBoundingClientRect();
          const minSize = 2 * MIN_CORNER_GAP + CORNER_SIZE;
          const width = Math.max(rect.width + 2 * PADDING, minSize);
          const height = Math.max(rect.height + 2 * PADDING, minSize);
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          setHoveredRect({
            left: centerX - width / 2,
            top: centerY - height / 2,
            right: centerX + width / 2,
            bottom: centerY + height / 2,
            width,
            height,
          });
        }
      }

      // Move SVG crosshair using transform for better performance
      if (svgRef.current) {
        svgRef.current.style.transform = `translate(${mouse.current.x - 9}px, ${mouse.current.y - 9}px)`;
      }

      // Move corners using transform
      let corners;
      if (hoveredRect) {
        corners = [
          { x: hoveredRect.left, y: hoveredRect.top },
          { x: hoveredRect.right - CORNER_SIZE, y: hoveredRect.top },
          { x: hoveredRect.right - CORNER_SIZE, y: hoveredRect.bottom - CORNER_SIZE },
          { x: hoveredRect.left, y: hoveredRect.bottom - CORNER_SIZE },
        ];
      } else {
        const gap = MIN_CORNER_GAP;
        corners = [
          {
            x: mouse.current.x - gap - CORNER_SIZE / 2,
            y: mouse.current.y - gap - CORNER_SIZE / 2,
          },
          {
            x: mouse.current.x + gap - CORNER_SIZE / 2,
            y: mouse.current.y - gap - CORNER_SIZE / 2,
          },
          {
            x: mouse.current.x + gap - CORNER_SIZE / 2,
            y: mouse.current.y + gap - CORNER_SIZE / 2,
          },
          {
            x: mouse.current.x - gap - CORNER_SIZE / 2,
            y: mouse.current.y + gap - CORNER_SIZE / 2,
          },
        ];
      }

      for (let i = 0; i < 4; ++i) {
        if (cornerRefs[i].current) {
          cornerRefs[i].current.style.transform = `translate(${corners[i].x}px, ${corners[i].y}px)`;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [hoveredRect, cornerRefs]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 10000,
        mixBlendMode: 'exclusion',
        overflow: 'visible',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s',
      }}
    >
      {/* Center SVG crosshair */}
      <Box
        ref={svgRef}
        sx={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 18,
          height: 18,
          pointerEvents: 'none',
          zIndex: 10000,
          willChange: 'transform',
          opacity: 0.95,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={20} height={20} viewBox="0 0 20 20" style={{ display: 'block' }}>
          <rect
            x={10 - CURSOR_THICKNESS / 2}
            y={3}
            width={CURSOR_THICKNESS}
            height={14}
            rx={CURSOR_THICKNESS / 2}
            fill={cursorColor}
          />
          <rect
            x={3}
            y={10 - CURSOR_THICKNESS / 2}
            width={14}
            height={CURSOR_THICKNESS}
            rx={CURSOR_THICKNESS / 2}
            fill={cursorColor}
          />
        </svg>
      </Box>
      {/* Four corners */}
      {[0, 1, 2, 3].map(i => (
        <Box
          key={i}
          ref={cornerRefs[i]}
          sx={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: CORNER_SIZE,
            height: CORNER_SIZE,
            pointerEvents: 'none',
            zIndex: 10000,
            willChange: 'transform',
            transition: `transform ${ANIMATION_DURATION}ms cubic-bezier(.4,1.6,.6,1)`,
          }}
        >
          <Corner index={i} color={cursorColor} />
        </Box>
      ))}
    </Box>
  );
};

export default CustomCursor;
