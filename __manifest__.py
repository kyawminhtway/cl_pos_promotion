# -*- coding: utf-8 -*-
{
    'name' : 'POS Promotion',
    'version' : '1.0',
    'summary': 'Dynamic Promotion Programs for Point of Sale',
    'sequence': 50,
    'description': """
Promotion Programs
====================
This module helps you to manage your promotion programs for point of sale. It is also super easy to use. Dynamic configuration is also available. Reporting & access rights features 
are also there.
""",
    'category': 'Point of Sale/Promotion Programs',
    'images' : [],
    'depends' : ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/promotion_program_views.xml',
        'views/promotion_rule_views.xml',
        'views/promotion_item_views.xml',
        'views/menuitems.xml',
    ],
    'assets': {
        'point_of_sale.assets': [
            'cl_pos_promotion/static/src/js/**/*',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'OPL-1',
}
