def compter_elements(liste):
    # Créer un dictionnaire pour stocker le compte de chaque élément
    compte = {}
    
    # Parcourir chaque élément de la liste
    for i in liste:
        # Si l'élément est déjà dans le dictionnaire, on incrémente le compteur
        if i in compte:
            compte[i] += 1
            print(compte[i])
        # Sinon, on l'ajoute avec un compteur à 1
        else:
            compte[i] = 1
            
    # Afficher les résultats
    for i, count in compte.items():
        print(f"{i} : {count} fois")
        
# Exemple d'utilisation
liste = [4, 2, 4, 3, 2, 4]
compter_elements(liste)
