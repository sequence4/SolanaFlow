import pool from "../../config/database";

export async function getProjectPorts(projectId: string): Promise<{ rpc: number, ws: number, faucet: number }> {
    try {
      const result = await pool.query(
        'SELECT details->>\'containerPorts\' as ports, container_name FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      if (result.rows[0]?.ports) {
        return JSON.parse(result.rows[0].ports);
      }
      
      if (result.rows[0]?.container_name) {
        console.log('[getProjectPorts] No ports stored, allocating new ones for', projectId);
        const { findAvailablePorts } = await import('../../utils/container/startProjectContainer');
        const ports = await findAvailablePorts();
        
        await pool.query(
          `UPDATE solanaproject 
           SET details = jsonb_set(COALESCE(details, '{}'::jsonb), '{containerPorts}', $1::jsonb)
           WHERE id = $2`,
          [JSON.stringify(ports), projectId]
        );
        
        console.log(`[getProjectPorts] Allocated and stored ports for ${projectId}:`, ports);
        return ports;
      }
    } catch (e) {
      console.warn('[getProjectPorts] Error:', e);
    }
    
    // Default fallback
    console.log('[getProjectPorts] Using fallback ports for project', projectId);
    return { rpc: 28899, ws: 28900, faucet: 28901 };
  }