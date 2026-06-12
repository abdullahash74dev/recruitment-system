// Ambient, decorative "AI aurora" glow — large blurred color blobs that
// drift slowly behind page content. Purely presentational; absolutely
// positioned and non-interactive so it never affects layout or a11y.
const AuroraBackground = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute -top-32 -left-24 w-[28rem] h-[28rem] md:w-[36rem] md:h-[36rem] rounded-full blur-3xl opacity-10 dark:opacity-25 animate-aurora-drift"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div
        className="absolute top-1/4 -right-32 w-[30rem] h-[30rem] md:w-[40rem] md:h-[40rem] rounded-full blur-3xl opacity-10 dark:opacity-20 animate-aurora-drift-slow"
        style={{ background: "hsl(var(--chart-3))" }}
      />
      <div
        className="absolute -bottom-32 left-1/4 w-[26rem] h-[26rem] md:w-[34rem] md:h-[34rem] rounded-full blur-3xl opacity-10 dark:opacity-20 animate-aurora-drift"
        style={{ background: "hsl(var(--accent))", animationDelay: "-10s" }}
      />
    </div>
  );
};

export default AuroraBackground;
