import React, { useEffect, useRef, useMemo } from 'react';

// Animation Configuration
const CONFIG = {
  // Grid settings
  GRID_STEP: 15, // Distance between particles in pixels
  PARTICLE_SIZE_MULTIPLIER: 6, // Base size multiplier for particles

  // Animation timing
  ANIMATION_SPEED: 0.05, // Base animation speed
  TARGET_FPS: 12, // Target frames per second
  FRAME_TIME: 1000 / 12, // Target frame time in ms

  // Noise settings
  NOISE_SCALE: {
    BASE: 900, // Base noise scale
    HUE: 1500, // Noise scale for hue variation
    VARIATION: 500, // Noise scale for size variation
  },

  // Color settings
  COLOR: {
    SATURATION: 70, // HSL saturation percentage
    LIGHTNESS: 50, // HSL lightness percentage
    HUE_VARIATION: 60, // Base hue variation
    HUE_OFFSET: 80, // Additional hue offset
  },

  // Rendering settings
  RENDER: {
    ALPHA: false, // Whether to use alpha channel
    OPACITY: 0.6, // Overall opacity of the animation
    BATCH_SIZE: 300, // Number of particles to process per batch
    CULLING: {
      ENABLED: true, // Whether to enable particle culling
      MIN_SIZE: 0.1, // Minimum particle size to render
    },
  },
};

// Object pool for particle positions
const createParticlePool = size => {
  const pool = new Array(size);
  for (let i = 0; i < size; i++) {
    pool[i] = {
      x: 0,
      y: 0,
      nx: 0,
      ny: 0,
      nx2: 0,
      ny2: 0,
      nx3: 0,
      ny3: 0,
    };
  }
  return pool;
};

// Add color interpolation helper
const interpolateColors = (colors1, colors2, factor) => {
  if (!colors1 || !colors2) return colors1 || colors2;

  return colors1.map((color1, i) => {
    const color2 = colors2[i] || color1;
    // Extract HSL values
    const hsl1 = color1.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
    const hsl2 = color2.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);

    if (!hsl1 || !hsl2) return color1;

    const h1 = parseInt(hsl1[1]);
    const s1 = parseInt(hsl1[2]);
    const l1 = parseInt(hsl1[3]);
    const a1 = parseFloat(hsl1[4]);

    const h2 = parseInt(hsl2[1]);
    const s2 = parseInt(hsl2[2]);
    const l2 = parseInt(hsl2[3]);
    const a2 = parseFloat(hsl2[4]);

    // Interpolate each component
    const h = Math.round(h1 + (h2 - h1) * factor);
    const s = Math.round(s1 + (s2 - s1) * factor);
    const l = Math.round(l1 + (l2 - l1) * factor);
    const a = a1 + (a2 - a1) * factor;

    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
  });
};

const BackgroundAnimation = ({ style = {} }) => {
  const canvasRef = useRef(null);
  const animationTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const globalHueSeedRef = useRef(Math.random() * 360);
  const frameIdRef = useRef(null);
  const noiseRef = useRef(null);
  const circlePathRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const visibleParticlesRef = useRef([]);
  const particlePoolRef = useRef(null);
  const activeCountRef = useRef(0);
  const tempVecRef = useRef({ x: 0, y: 0 });
  const isPausedRef = useRef(false);

  // Pre-compute reusable objects and values
  const reusableObjects = useMemo(
    () => ({
      clearRect: { x: 0, y: 0, width: 0, height: 0 },
      transform: { x: 0, y: 0, scale: 0 },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: CONFIG.RENDER.ALPHA,
      desynchronized: true, // Reduce latency
      powerPreference: 'high-performance', // Prioritize performance
    });

    // Handle window focus events
    const handleFocus = () => {
      isPausedRef.current = false;
      if (!frameIdRef.current) {
        animate();
      }
    };

    const handleBlur = () => {
      isPausedRef.current = true;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Pre-compute circle path
    circlePathRef.current = new Path2D();
    circlePathRef.current.arc(0, 0, 1, 0, Math.PI * 2);

    const buildGrid = (width, height) => {
      const count =
        Math.ceil(width / CONFIG.GRID_STEP) * Math.ceil(height / CONFIG.GRID_STEP);
      if (!particlePoolRef.current || particlePoolRef.current.length < count) {
        particlePoolRef.current = createParticlePool(count);
      }

      let particleIndex = 0;
      for (let x = 0; x < width; x += CONFIG.GRID_STEP) {
        for (let y = 0; y < height; y += CONFIG.GRID_STEP) {
          const pos = particlePoolRef.current[particleIndex++];
          pos.x = x;
          pos.y = y;
          pos.nx = x / CONFIG.NOISE_SCALE.BASE;
          pos.ny = y / CONFIG.NOISE_SCALE.BASE;
          pos.nx2 = x / CONFIG.NOISE_SCALE.HUE;
          pos.ny2 = y / CONFIG.NOISE_SCALE.HUE;
          pos.nx3 = x / CONFIG.NOISE_SCALE.VARIATION;
          pos.ny3 = y / CONFIG.NOISE_SCALE.VARIATION;
        }
      }
      activeCountRef.current = particleIndex;
    };

    // Backing store stays sharp on high-DPI screens. Dots are placed in CSS pixels,
    // which is the visible window, so the extra device pixels are not simulated.
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      reusableObjects.clearRect.width = width;
      reusableObjects.clearRect.height = height;
      buildGrid(width, height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simplex noise module with cached gradients
    noiseRef.current = (function () {
      const module = {};
      const grad3 = [
        [1, 1, 0],
        [-1, 1, 0],
        [1, -1, 0],
        [-1, -1, 0],
        [1, 0, 1],
        [-1, 0, 1],
        [1, 0, -1],
        [-1, 0, -1],
        [0, 1, 1],
        [0, -1, 1],
        [0, 1, -1],
        [0, -1, -1],
      ];

      const perm = new Uint8Array(512);
      const gradP = new Array(512);

      module.seed = function (seed) {
        if (seed > 0 && seed < 1) seed *= 65536;
        seed = Math.floor(seed);
        if (seed < 256) seed |= seed << 8;

        for (let i = 0; i < 256; i++) {
          let v;
          if (i & 1) {
            v = i ^ (seed & 255);
          } else {
            v = i ^ ((seed >> 8) & 255);
          }
          perm[i] = perm[i + 256] = v;
          gradP[i] = gradP[i + 256] = grad3[v % 12];
        }
      };

      const F3 = 1 / 3;
      const G3 = 1 / 6;

      module.simplex3 = function (xin, yin, zin) {
        const s = (xin + yin + zin) * F3;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const k = Math.floor(zin + s);
        const t = (i + j + k) * G3;
        const x0 = xin - i + t;
        const y0 = yin - j + t;
        const z0 = zin - k + t;

        let i1, j1, k1;
        let i2, j2, k2;

        if (x0 >= y0) {
          if (y0 >= z0) {
            i1 = 1;
            j1 = 0;
            k1 = 0;
            i2 = 1;
            j2 = 1;
            k2 = 0;
          } else if (x0 >= z0) {
            i1 = 1;
            j1 = 0;
            k1 = 0;
            i2 = 1;
            j2 = 0;
            k2 = 1;
          } else {
            i1 = 0;
            j1 = 0;
            k1 = 1;
            i2 = 1;
            j2 = 0;
            k2 = 1;
          }
        } else {
          if (y0 < z0) {
            i1 = 0;
            j1 = 0;
            k1 = 1;
            i2 = 0;
            j2 = 1;
            k2 = 1;
          } else if (x0 < z0) {
            i1 = 0;
            j1 = 1;
            k1 = 0;
            i2 = 0;
            j2 = 1;
            k2 = 1;
          } else {
            i1 = 0;
            j1 = 1;
            k1 = 0;
            i2 = 1;
            j2 = 1;
            k2 = 0;
          }
        }

        const x1 = x0 - i1 + G3;
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2 * G3;
        const y2 = y0 - j2 + 2 * G3;
        const z2 = z0 - k2 + 2 * G3;
        const x3 = x0 - 1 + 3 * G3;
        const y3 = y0 - 1 + 3 * G3;
        const z3 = z0 - 1 + 3 * G3;

        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;

        const gi0 = gradP[ii + perm[jj + perm[kk]]];
        const gi1 = gradP[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
        const gi2 = gradP[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
        const gi3 = gradP[ii + 1 + perm[jj + 1 + perm[kk + 1]]];

        let n0 = 0,
          n1 = 0,
          n2 = 0,
          n3 = 0;

        const t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 >= 0) {
          const t02 = t0 * t0;
          n0 = t02 * t02 * (gi0[0] * x0 + gi0[1] * y0 + gi0[2] * z0);
        }

        const t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 >= 0) {
          const t12 = t1 * t1;
          n1 = t12 * t12 * (gi1[0] * x1 + gi1[1] * y1 + gi1[2] * z1);
        }

        const t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 >= 0) {
          const t22 = t2 * t2;
          n2 = t22 * t22 * (gi2[0] * x2 + gi2[1] * y2 + gi2[2] * z2);
        }

        const t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 >= 0) {
          const t32 = t3 * t3;
          n3 = t32 * t32 * (gi3[0] * x3 + gi3[1] * y3 + gi3[2] * z3);
        }

        return 32 * (n0 + n1 + n2 + n3);
      };

      return module;
    })();

    noiseRef.current.seed(Math.random());

    const updateVisibleParticles = t2 => {
      const pool = particlePoolRef.current;
      const count = activeCountRef.current;
      const visible = visibleParticlesRef.current;
      if (!CONFIG.RENDER.CULLING.ENABLED) {
        for (let i = 0; i < count; i++) visible[i] = pool[i];
        visible.length = count;
        return;
      }

      let n = 0;
      for (let i = 0; i < count; i++) {
        const pos = pool[i];
        const point = Math.abs(noiseRef.current.simplex3(pos.nx, pos.ny, t2));
        if (point < CONFIG.RENDER.CULLING.MIN_SIZE) continue;
        visible[n++] = pos;
      }
      visible.length = n;
    };

    function animate() {
      if (isPausedRef.current) return;

      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;

      // Skip frame if not enough time has passed
      if (elapsed < CONFIG.FRAME_TIME) {
        frameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTimeRef.current = now;
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      animationTimeRef.current += deltaTime * CONFIG.ANIMATION_SPEED;

      ctx.clearRect(
        reusableObjects.clearRect.x,
        reusableObjects.clearRect.y,
        reusableObjects.clearRect.width,
        reusableObjects.clearRect.height
      );

      const t = animationTimeRef.current;
      const t2 = t * 2;
      const seed = globalHueSeedRef.current;

      updateVisibleParticles(t2);

      // Collect colors for gradient with more variation
      const gradientColors = new Map(); // Using Map to store colors with their intensities

      // Batch process particles
      for (let i = 0; i < visibleParticlesRef.current.length; i += CONFIG.RENDER.BATCH_SIZE) {
        const end = Math.min(i + CONFIG.RENDER.BATCH_SIZE, visibleParticlesRef.current.length);

        for (let j = i; j < end; j++) {
          const pos = visibleParticlesRef.current[j];
          const point = Math.abs(noiseRef.current.simplex3(pos.nx, pos.ny, t2));
          const baseHue =
            seed + noiseRef.current.simplex3(pos.nx2, pos.ny2, t) * CONFIG.COLOR.HUE_VARIATION;
          const hueVariation =
            CONFIG.COLOR.HUE_OFFSET +
            noiseRef.current.simplex3(pos.nx3, pos.ny3, t) * CONFIG.COLOR.HUE_VARIATION;
          const hue = (baseHue + point * hueVariation) % 360;

          const color = `hsla(${hue}, ${CONFIG.COLOR.SATURATION}%, ${CONFIG.COLOR.LIGHTNESS}%, ${point})`;
          ctx.fillStyle = color;

          // Add color to gradient map if it's significant enough
          if (point > 0.2) {
            const roundedHue = Math.round(hue / 15) * 15; // Increased rounding for more stability
            const key = `${roundedHue}`;
            if (!gradientColors.has(key) || gradientColors.get(key).intensity < point) {
              gradientColors.set(key, { color, intensity: point });
            }
          }

          // Reuse transform object
          const transform = reusableObjects.transform;
          transform.x = pos.x;
          transform.y = pos.y;
          transform.scale = point * CONFIG.PARTICLE_SIZE_MULTIPLIER;

          ctx.save();
          ctx.translate(transform.x, transform.y);
          ctx.scale(transform.scale, transform.scale);
          ctx.fill(circlePathRef.current);
          ctx.restore();
        }
      }

      // Emit color update event with more colors
      if (gradientColors.size > 0) {
        // Sort colors by intensity and take top 6
        const newColors = Array.from(gradientColors.values())
          .sort((a, b) => b.intensity - a.intensity)
          .slice(0, 6)
          .map(c => c.color);

        // Only emit update every 500ms for smoother transitions
        if (!window.lastColorUpdate || now - window.lastColorUpdate > 500) {
          window.lastColorUpdate = now;
          window.dispatchEvent(
            new CustomEvent('backgroundAnimationColorUpdate', {
              detail: { colors: newColors },
            })
          );
        }
      }

      frameIdRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        opacity: style.opacity ?? CONFIG.RENDER.OPACITY,
        backgroundColor: '#000',
        ...style,
      }}
    />
  );
};

export default React.memo(BackgroundAnimation);
