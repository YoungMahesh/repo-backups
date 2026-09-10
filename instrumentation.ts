export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalDevCronRunner } = await import(
      "@/lib/backup/dev-runner"
    );
    startLocalDevCronRunner();
  }
}
