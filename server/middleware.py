from functools import wraps
from flask import request, jsonify
from auth import verify_token

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"message": "Authentification requise"}), 401
        request.user = decoded  # Attach user data to request for route access
        return f(*args, **kwargs)
    return decorated_function

def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            decoded = verify_token(token)
            if not decoded:
                return jsonify({"message": "Authentification requise"}), 401
            if decoded.get("role") != role:
                return jsonify({"message": "Accès non autorisé pour ce rôle"}), 403
            request.user = decoded  # Attach user data to request
            return f(*args, **kwargs)
        return decorated_function
    return decorator