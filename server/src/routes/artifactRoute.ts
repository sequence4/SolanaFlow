import express from "express";
import { authMiddleware } from "@/middleware/authMiddleware";  // switch back once DEV_AUTH is removed
import { getBuildArtifactTask } from "@/utils/projectUtils";
import { AppError } from "@/middleware/errorHandler";

const router = express.Router();

// ── TEMP guard – mirrors deployRoutes.ts ──────────────────────────────
const DEV_AUTH = (req: any, _res: any, next: () => void) => {
  req.user = { id: "00000000-0000-0000-0000-000000000000" };
  next();
};
const guard = DEV_AUTH;                         // flip to authMiddleware later
// ──────────────────────────────────────────────────────────────────────

router.get("/:id/artifact", guard, async (req, res, next) => {
  try {
    const { id } = req.params;

    // retrieve the base-64 artefact produced by the last build
    const { status, base64So } = await getBuildArtifactTask(id);

    if (status !== "success" || !base64So) {
      return next(new AppError("Build artefact not found", 404));
    }

    const binary = Buffer.from(base64So, "base64");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="program-${id}.so"`
    );
    res.send(binary);
  } catch (err) {
    next(err);
  }
});

export default router; 