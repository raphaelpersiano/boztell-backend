import express from 'express';
import { getLeads, getLeadsCount, getLeadById, insertLead, updateLead, deleteLead, getLeadsStats, getLeadsByUserId, updateRoom } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all leads with filtering and search
router.get('/', async (req, res) => {
  try {
    const { 
      leads_status,
      contact_status,
      loan_type,
      utm_id,
      search, 
      page = 1, 
      limit = 50 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const filters = {
      leads_status,
      contact_status,
      loan_type,
      utm_id,
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
      utm_id,
      name,
      phone,
      outstanding,
      loan_type,
      leads_status = 'cold',
      contact_status = 'uncontacted'
    } = req.body;

    if (!name || !phone || !loan_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, phone, loan_type'
      });
    }

    const leadData = {
      utm_id: utm_id || null,
      name,
      phone,
      outstanding: outstanding || 0,
      loan_type,
      leads_status,
      contact_status
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
      utm_id,
      name,
      phone,
      outstanding,
      loan_type,
      leads_status,
      contact_status,
      room_id,
      title
    } = req.body;

    // Build updates object with only non-null values
    const updates = {};
    if (utm_id !== undefined) updates.utm_id = utm_id;
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (outstanding !== undefined) updates.outstanding = outstanding;
    if (loan_type !== undefined) updates.loan_type = loan_type;
    if (leads_status !== undefined) updates.leads_status = leads_status;
    if (contact_status !== undefined) updates.contact_status = contact_status;

    // Update lead
    const { rows } = await updateLead(id, updates);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // If room_id and title provided, update room title as well
    if (room_id && title) {
      try {
        await updateRoom(room_id, { title });
        logger.info({ room_id, title, lead_id: id }, 'Room title updated along with lead');
      } catch (roomError) {
        logger.error({ error: roomError, room_id, title }, 'Failed to update room title, but lead updated successfully');
        // Don't fail the whole request if room update fails
      }
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

// Update lead contact status
router.patch('/:id/contact-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_status } = req.body;

    if (!contact_status) {
      return res.status(400).json({ 
        success: false, 
        error: 'contact_status is required',
        valid_values: ['uncontacted', 'contacted']
      });
    }

    const updates = {
      contact_status
    };

    const { rows } = await updateLead(id, updates);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to update lead contact status');
    res.status(500).json({ success: false, error: 'Failed to update lead contact status' });
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

// Get leads assigned to specific user (via room participants)
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id is required' 
      });
    }

    const { rows } = await getLeadsByUserId(user_id);

    res.json({ 
      success: true, 
      data: rows,
      total: rows.length,
      user_id,
      message: rows.length === 0 ? 'No leads found for this user' : `Found ${rows.length} leads for user`
    });
  } catch (error) {
    logger.error({ error, user_id: req.params.user_id }, 'Failed to get leads by user ID');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get leads by user ID',
      details: error.message
    });
  }
});

// Get leads by phone number
router.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');
    
    const { rows } = await getLeads({ phone: cleanPhone });

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Lead not found with this phone number',
        phone: cleanPhone
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to get lead by phone');
    res.status(500).json({ success: false, error: 'Failed to get lead by phone' });
  }
});

// Update lead status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { leads_status } = req.body;

    const validStatuses = ['cold', 'warm', 'hot', 'paid', 'service', 'repayment', 'advocate'];

    if (!leads_status) {
      return res.status(400).json({ 
        success: false, 
        error: 'leads_status is required',
        valid_values: validStatuses
      });
    }

    if (!validStatuses.includes(leads_status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid leads_status: ${leads_status}`,
        valid_values: validStatuses
      });
    }

    const updates = { leads_status };
    const { rows } = await updateLead(id, updates);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error({ error }, 'Failed to update lead status');
    res.status(500).json({ success: false, error: 'Failed to update lead status' });
  }
});

// Get leads by UTM tracking
router.get('/utm/:utm_id', async (req, res) => {
  try {
    const { utm_id } = req.params;
    
    const { rows } = await getLeads({ utm_id });

    res.json({ 
      success: true, 
      data: rows,
      total: rows.length,
      utm_id 
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get leads by UTM');
    res.status(500).json({ success: false, error: 'Failed to get leads by UTM' });
  }
});

// Bulk update leads
router.patch('/bulk', async (req, res) => {
  try {
    const { lead_ids, updates } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'lead_ids array is required' 
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'updates object is required' 
      });
    }

    // Validate update fields
    const allowedFields = ['utm_id', 'name', 'phone', 'outstanding', 'loan_type', 'leads_status', 'contact_status'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid fields: ${invalidFields.join(', ')}`,
        allowed_fields: allowedFields
      });
    }

    const results = [];
    for (const leadId of lead_ids) {
      try {
        const { rows } = await updateLead(leadId, updates);
        if (rows.length > 0) {
          results.push(rows[0]);
        }
      } catch (error) {
        logger.error({ error, leadId }, 'Failed to update individual lead in bulk operation');
      }
    }

    res.json({ 
      success: true, 
      data: results,
      updated: results.length,
      requested: lead_ids.length
    });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk update leads');
    res.status(500).json({ success: false, error: 'Failed to bulk update leads' });
  }
});

export default router;