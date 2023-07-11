from odoo import api, models, fields


class PromotionProgram(models.Model):

    _name = 'promotion.program'
    _inherit = ['mail.thread']
    _description = 'Promotion Program'

    name = fields.Char('Name', required=True, tracking=1)
    active = fields.Boolean('Active', default=True, tracking=2)
    date_from = fields.Date('Date From', tracking=3)
    date_to = fields.Date('Date To', tracking=4)
    rule_id = fields.Many2one('promotion.rule', 'Rule', required=True, tracking=5)
    item_id = fields.Many2one('promotion.item', 'Item', required=True, tracking=6)
    item_type = fields.Selection(related='item_id.type', string='Item Type')
    can_be_merged = fields.Boolean('Can be merged with other Discounts', tracking=7)
    config_ids = fields.Many2many('pos.config', 'promotion_program_config_rel', 'program_id', 'config_id', 'Available Shops')
    partner_ids = fields.Many2many('res.partner', 'promotion_program_partner_rel', 'program_id', 'partner_id', 'Customers')
    note = fields.Text('Note')

