import express from 'express';
import { getLeads, getLeadsCount, getLeadById, insertLead, updateLead, deleteLead, getLeadsStats } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all leads with filtering and search
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      agent_id, 
      search, 
      page = 1, 
      limit = 50 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const filters = {
      status,
      agent_id,
      search,
      limit: parseInt(limit),
      offset
    };

    const { rows } = await getLeads(filters);
    const { rows: countRows } = await getLeadsCount(filters);
    const total = parseInt(countRows[0].count);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get leads');
    res.status(500).json({ success: false, error: 'Failed to get leads' });
  }
});

// Get single lead
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await getLeadById(id);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to get lead');
    res.status(500).json({ success: false, error: 'Failed to get lead' });
  }
});

// Create new lead
router.post('/', async (req, res) => {
  try {
    const {
      nama_lengkap,
      nomor_telpon,
      nominal_pinjaman,
      jenis_utang,
      leads_status = 'cold',
      assigned_agent_id,
      notes,
      metadata = {}
    } = req.body;

    if (!nama_lengkap || !nomor_telpon || !jenis_utang) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nama_lengkap, nomor_telpon, jenis_utang'
      });
    }

    const leadData = {
      nama_lengkap,
      nomor_telpon,
      nominal_pinjaman: nominal_pinjaman || 0,
      jenis_utang,
      leads_status,
      assigned_agent_id: assigned_agent_id || null,
      notes: notes || null,
      metadata
    };

    const { rows } = await insertLead(leadData);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to create lead');
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
});

// Update lead
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nama_lengkap,
      nomor_telpon,
      nominal_pinjaman,
      jenis_utang,
      leads_status,
      assigned_agent_id,
      notes,
      metadata
    } = req.body;

    // Build updates object with only non-null values
    const updates = {};
    if (nama_lengkap !== undefined) updates.nama_lengkap = nama_lengkap;
    if (nomor_telpon !== undefined) updates.nomor_telpon = nomor_telpon;
    if (nominal_pinjaman !== undefined) updates.nominal_pinjaman = nominal_pinjaman;
    if (jenis_utang !== undefined) updates.jenis_utang = jenis_utang;
    if (leads_status !== undefined) updates.leads_status = leads_status;
    if (assigned_agent_id !== undefined) updates.assigned_agent_id = assigned_agent_id;
    if (notes !== undefined) updates.notes = notes;
    if (metadata !== undefined) updates.metadata = metadata;

    const { rows } = await updateLead(id, updates);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to update lead');
    res.status(500).json({ success: false, error: 'Failed to update lead' });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await deleteLead(id);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete lead');
    res.status(500).json({ success: false, error: 'Failed to delete lead' });
  }
});

// Assign lead to agent
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id, agent_name } = req.body;

    if (!agent_id) {
      return res.status(400).json({ success: false, error: 'agent_id is required' });
    }

    const updates = {
      assigned_agent_id: agent_id,
      assigned_agent_name: agent_name
    };

    const { rows } = await updateLead(id, updates);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to assign lead');
    res.status(500).json({ success: false, error: 'Failed to assign lead' });
  }
});

// Get leads statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { rows } = await getLeadsStats();

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ error }, 'Failed to get leads stats');
    res.status(500).json({ success: false, error: 'Failed to get leads stats' });
  }
});

export default router;