from flask import Blueprint

# Créer le blueprint principal d'abord
recruteurv1_bp = Blueprint('recruteurv1_bp', __name__)

# Import les sous-blueprints après
from .offres_recruteur import offres_recruteur_bp
from .dashboard_recruteur import Dashboard_recruteur_bp

# Enregistrer les sous-blueprints
recruteurv1_bp.register_blueprint(offres_recruteur_bp)
recruteurv1_bp.register_blueprint(Dashboard_recruteur_bp) 