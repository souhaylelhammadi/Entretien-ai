# This file makes the recruteur directory a Python package
from ..recruteurv1.Offres_recruteur import Offres_recruteur_bp
from ..recruteurv1.candidates import candidates_bp
from .profile import profile_bp
__all__ = ['Offres_recruteur_bp', 'candidates_bp', 'profile_bp'] 