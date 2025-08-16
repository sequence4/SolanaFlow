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
    
    // Validate ELF magic header before sending
    if (binary.length < 4 || 
        binary[0] !== 0x7f || 
        binary[1] !== 0x45 || 
        binary[2] !== 0x4c || 
        binary[3] !== 0x46) {
      console.error(`[ARTIFACT] Invalid ELF header: [${binary.slice(0, 4).join(',')}]`);
      console.error(`[ARTIFACT] Binary length: ${binary.length} bytes`);
      console.error(`[ARTIFACT] Base64 length: ${base64So.length} chars`);
      return next(new AppError("Invalid program artifact - corrupted ELF file", 400));
    }
    
    console.log(`[ARTIFACT] Valid ELF header verified for project ${id} (${binary.length} bytes)`);
    
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