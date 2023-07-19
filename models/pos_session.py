import base64
from odoo import api, models, fields
from odoo.osv.expression import OR
from odoo.modules.module import get_resource_path


class PosSession(models.Model):

    _inherit = 'pos.session'

    def _pos_data_process(self, loaded_data):
        gift_icon = open(get_resource_path('cl_pos_promotion', 'static/images/gift.png'), 'rb').read()
        loaded_data['cl_gift_icon'] = base64.b64encode(gift_icon)
        return super()._pos_data_process(loaded_data)

    @api.model
    def _pos_ui_models_to_load(self):
        models_to_load = super()._pos_ui_models_to_load()
        models_to_load = [
            *models_to_load,
            'promotion.program',
            'promotion.rule',
            'promotion.combo.line',
            'promotion.item',
            'promotion.free.product',
        ] 
        return models_to_load
    
    @staticmethod
    def _prepare_records(records, grouped_options, ids_options={}):
        data = {}
        for val in grouped_options.values():
            data[val] = {}
        for val in ids_options.values():
            data[val] = []
        for record in records:
            for field_to_group, group_key in grouped_options.items():
                if field_to_group == 'id':
                    data[group_key][record[field_to_group]] = record
                else:
                    data_to_group = record[field_to_group]
                    if not data_to_group:
                        continue
                    data_to_group = data_to_group[0]
                    grouped_records = data[group_key].get(data_to_group, [])
                    data[group_key][data_to_group] = [record, *grouped_records]
            for id_field, id_key in ids_options.items():
                data_id = record[id_field]
                if not data_id:
                    continue
                data[id_key].append(data_id)
        return data
    
    def _prepare_pos_promotion_data(self, model, params):
        records = self.env[model].search_read(**params['search_params'])
        data = self._prepare_records(records=records, 
                                     grouped_options=params['grouped_params'],
                                     ids_options=params['ids_params'])
        return data
    
    def _loader_params_product_product(self):
        res = super()._loader_params_product_product()
        domain = res['search_params']['domain']
        discount_products = self.env['promotion.item'].get_discount_products()
        if discount_products:
            res['search_params']['domain'] = OR([domain, [('id', 'in', discount_products.ids)]])
        return res

    def _loader_params_promotion_program(self):
        today = fields.Date.context_today(self)
        domain = [
            '&', 
            '|', 
            ('config_ids', 'in', self.config_id.ids), 
            ('config_ids', '=', False), 
            '|', 
            '|', 
            '|', 
            '&', 
            ('date_from', '<=', today), 
            ('date_to', '>=', today), 
            '&', 
            ('date_from', '<=', today), 
            ('date_to', '=', False), 
            '&', 
            ('date_from', '=', False), 
            ('date_to', '>=', today), 
            '&', 
            ('date_from', '=', False), 
            ('date_to', '=', False)
        ]
        return {
            'search_params': {
                'domain': domain, 
                'fields': ['name', 'rule_id', 'item_id', 'can_be_merged', 'partner_ids']
            },
            'ids_params': {'id': 'ids'},
            'grouped_params': {'id': 'by_id', 'rule_id': 'by_rule_id', 'item_id': 'by_item_id'}
        }
    
    def _loader_params_promotion_rule(self):
        program_ids = self.env.context.get('loaded_data')['promotion.program']['ids']
        return {
            'search_params': {
                'domain': [('program_ids', 'in', program_ids)], 
                'fields': ['name', 'type', 'price_rule', 'min_amt', 'min_qty', 'product_ids', 'category_ids', 'combo_line_ids', 'program_ids']
            },
            'ids_params': {'id': 'ids'},
            'grouped_params': {'id': 'by_id'}
        }
    
    def _loader_params_promotion_combo_line(self):
        rule_ids = self.env.context.get('loaded_data')['promotion.rule']['ids']
        return {
            'search_params': {
                'domain': [('rule_id', 'in', rule_ids)], 
                'fields': ['based_on', 'product_ids', 'category_ids', 'qty']
            },
            'ids_params': {},
            'grouped_params': {'id': 'by_id'}
        }
    
    def _loader_params_promotion_item(self):
        program_ids = self.env.context.get('loaded_data')['promotion.program']['ids']
        return {
            'search_params': {
                'domain': [('program_ids', 'in', program_ids)], 
                'fields': [
                    'name', 'type', 'discount_rule', 'price_rule', 'discount', 'product_id', 
                    'product_ids', 'category_ids', 'item_rule', 'max_occurrence', 'max_discount', 'free_product_ids', 'program_ids'
                ]
            },
            'ids_params': {'id': 'ids'},
            'grouped_params': {'id': 'by_id'}
        }
    
    def _loader_params_promotion_free_product(self):
        item_ids = self.env.context.get('loaded_data')['promotion.item']['ids']
        return {
            'search_params': {
                'domain': [('item_id', 'in', item_ids)], 
                'fields': ['product_id', 'qty']
            },
            'ids_params': {},
            'grouped_params': {'id': 'by_id'}
        }

    def _get_pos_ui_promotion_program(self, params):
        return self._prepare_pos_promotion_data('promotion.program', params)

    def _get_pos_ui_promotion_rule(self, params):
        return self._prepare_pos_promotion_data('promotion.rule', params)

    def _get_pos_ui_promotion_combo_line(self, params):
        return self._prepare_pos_promotion_data('promotion.combo.line', params)

    def _get_pos_ui_promotion_item(self, params):
        return self._prepare_pos_promotion_data('promotion.item', params)

    def _get_pos_ui_promotion_free_product(self, params):
        return self._prepare_pos_promotion_data('promotion.free.product', params)

