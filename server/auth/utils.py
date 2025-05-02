def verify_token(token):
    """
    Verify a simplified authentication token.
    The simplified format is "EMAIL:adresse@email.com"
    """
    try:
        # Convert token to string if it's bytes
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        # Remove 'Bearer ' prefix if present
        if token and token.startswith('Bearer '):
            token = token[7:]
        
        # Ensure token starts with "EMAIL:"
        if not token.startswith('EMAIL:'):
            print("Format de token invalide: ne commence pas par EMAIL:")
            return None
            
        # Extract email from token
        email = token[6:]  # Everything after "EMAIL:"
        print(f"Email extrait du token: {email}")
        
        return email
        
    except Exception as e:
        print(f"Erreur dans verify_token: {str(e)}")
        return None