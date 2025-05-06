test("GA env id not empty in prod build", () => {
  if (process.env.NODE_ENV === "production") {
    expect(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID).toMatch(/^G-/);
  }
}); 