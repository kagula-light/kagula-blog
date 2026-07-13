const targets = [
  { name: "web", url: "http://web:3000/api/health/ready" },
  { name: "worker", url: "http://worker:3001/health/ready" },
];

const deadline = Date.now() + 60_000;
for (;;) {
  const results = await Promise.all(
    targets.map(async ({ name, url }) => {
      try {
        const response = await fetch(url);
        const body = await response.json();
        console.log(
          `${name}: status=${response.status} service=${String(body.service ?? "unknown")}`,
        );
        return response.ok && body.status === "ok" && body.service === name;
      } catch {
        console.log(`${name}: unavailable`);
        return false;
      }
    }),
  );
  if (results.every(Boolean)) process.exit(0);
  if (Date.now() >= deadline) process.exit(1);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
