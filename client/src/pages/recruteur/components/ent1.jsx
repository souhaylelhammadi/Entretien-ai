import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchRecruiterInterviews,
  fetchInterviewDetails,
  clearError,
  clearSelectedInterview,
} from "../../store/recruteur/ent1";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { PlayArrow, Visibility } from "@mui/icons-material";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const InterviewSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { interviews, selectedInterview, loading, error } = useSelector(
    (state) => state.entretiens
  );
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    console.log("Fetching interviews...");
    dispatch(fetchRecruiterInterviews());

    return () => {
      dispatch(clearError());
      dispatch(clearSelectedInterview());
    };
  }, [dispatch, navigate]);

  useEffect(() => {
    console.log("Current interviews state:", interviews);
  }, [interviews]);

  const handleViewDetails = async (interviewId) => {
    try {
      console.log("Fetching details for interview:", interviewId);
      await dispatch(fetchInterviewDetails(interviewId)).unwrap();
      setOpenDialog(true);
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    dispatch(clearSelectedInterview());
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "termine":
        return "success";
      case "en_cours":
        return "warning";
      case "planifie":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "termine":
        return "Terminé";
      case "en_attente":
        return "En attente";
      case "planifie":
        return "Planifié";
      default:
        return status;
    }
  };

  if (loading && !interviews.length) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mt: 2 }}
        onClose={() => dispatch(clearError())}
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Entretiens Passés
      </Typography>

      {interviews.length === 0 ? (
        <Alert severity="info">Aucun entretien passé trouvé</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Offre</TableCell>
                <TableCell>Candidat</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow
                  key={interview.id}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body1">
                      {interview.offre?.titre || "Non défini"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {interview.offre?.entreprise || "Non définie"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">
                      {interview.candidat?.nom || "Non défini"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {interview.candidat?.email || "Non défini"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {interview.datePrevue
                      ? format(new Date(interview.datePrevue), "dd MMMM yyyy", {
                          locale: fr,
                        })
                      : interview.dateCreation
                      ? format(
                          new Date(interview.dateCreation),
                          "dd MMMM yyyy",
                          {
                            locale: fr,
                          }
                        )
                      : "Non définie"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(interview.statut)}
                      color={getStatusColor(interview.statut)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {interview.video?.url && (
                      <IconButton
                        color="primary"
                        onClick={() =>
                          window.open(interview.video.url, "_blank")
                        }
                        size="small"
                        sx={{ mr: 1 }}
                      >
                        <PlayArrow />
                      </IconButton>
                    )}
                    <IconButton
                      color="primary"
                      onClick={() => handleViewDetails(interview.id)}
                      size="small"
                    >
                      <Visibility />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
      >
        {selectedInterview && (
          <>
            <DialogTitle>Détails de l'entretien</DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", gap: 3, mt: 2 }}>
                {/* Colonne de gauche - Informations */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Informations générales
                  </Typography>
                  <Typography variant="body1">
                    Statut: {getStatusLabel(selectedInterview.statut)}
                  </Typography>
                  <Typography variant="body1">
                    Date prévue:{" "}
                    {selectedInterview.date_prevue
                      ? format(
                          new Date(selectedInterview.date_prevue),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )
                      : "Non définie"}
                  </Typography>
                  <Typography variant="body1">
                    Date de création:{" "}
                    {selectedInterview.date_creation
                      ? format(
                          new Date(selectedInterview.date_creation),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )
                      : "Non définie"}
                  </Typography>
                  <Typography variant="body1">
                    Dernière mise à jour:{" "}
                    {selectedInterview.date_maj
                      ? format(
                          new Date(selectedInterview.date_maj),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )
                      : "Non définie"}
                  </Typography>
                  <Typography variant="body1">
                    Terminé le:{" "}
                    {selectedInterview.completed_at
                      ? format(
                          new Date(selectedInterview.completed_at),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )
                      : "Non défini"}
                  </Typography>

                  <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
                    Candidat
                  </Typography>
                  <Typography variant="body1">
                    Nom: {selectedInterview.candidat?.nom || "Non défini"}
                  </Typography>
                  <Typography variant="body1">
                    Email: {selectedInterview.candidat?.email || "Non défini"}
                  </Typography>
                  <Typography variant="body1">
                    Téléphone:{" "}
                    {selectedInterview.candidat?.telephone || "Non défini"}
                  </Typography>

                  <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
                    Offre
                  </Typography>
                  <Typography variant="body1">
                    Titre: {selectedInterview.offre?.titre || "Non défini"}
                  </Typography>
                  <Typography variant="body1">
                    Entreprise:{" "}
                    {selectedInterview.offre?.entreprise || "Non définie"}
                  </Typography>
                  <Typography variant="body1">
                    Localisation:{" "}
                    {selectedInterview.offre?.localisation || "Non définie"}
                  </Typography>
                </Box>

                {/* Colonne de droite - Vidéo et Transcription */}
                <Box sx={{ flex: 1 }}>
                  {selectedInterview.video?.url && (
                    <>
                      <Typography variant="h6" gutterBottom>
                        Vidéo de l'entretien
                      </Typography>
                      <Box
                        sx={{
                          mt: 2,
                          mb: 3,
                          position: "relative",
                          width: "100%",
                          paddingTop: "56.25%",
                          backgroundColor: "#000",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <video
                          controls
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                          src={`${
                            process.env.REACT_APP_API_URL ||
                            "http://localhost:5000"
                          }${
                            selectedInterview.video.url
                          }?token=${encodeURIComponent(
                            localStorage.getItem("token")
                          )}`}
                          onError={(e) => {
                            console.error(
                              "Erreur de chargement de la vidéo:",
                              e
                            );
                            const videoElement = e.target;
                            videoElement.style.display = "none";
                            const errorMessage = document.createElement("div");
                            errorMessage.style.position = "absolute";
                            errorMessage.style.top = "50%";
                            errorMessage.style.left = "50%";
                            errorMessage.style.transform =
                              "translate(-50%, -50%)";
                            errorMessage.style.color = "white";
                            errorMessage.style.textAlign = "center";
                            errorMessage.innerHTML =
                              "Erreur de chargement de la vidéo.<br>Veuillez réessayer.";
                            videoElement.parentNode.appendChild(errorMessage);
                          }}
                          onLoadedMetadata={(e) => {
                            console.log("Métadonnées de la vidéo chargées");
                          }}
                          onLoadedData={(e) => {
                            console.log("Données de la vidéo chargées");
                          }}
                          onCanPlay={(e) => {
                            console.log("La vidéo peut être lue");
                          }}
                        />
                      </Box>
                    </>
                  )}

                  {selectedInterview.video?.transcription && (
                    <>
                      <Typography variant="h6" gutterBottom>
                        Transcription
                      </Typography>
                      <Box
                        sx={{
                          mt: 2,
                          mb: 3,
                          p: 2,
                          bgcolor: "grey.100",
                          borderRadius: 2,
                          maxHeight: "300px",
                          overflowY: "auto",
                        }}
                      >
                        <Typography
                          variant="body1"
                          component="pre"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {selectedInterview.video.transcription}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>

              {/* Questions et Réponses en bas */}
              {selectedInterview.qa_pairs &&
                selectedInterview.qa_pairs.length > 0 && (
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom>
                      Questions et Réponses
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      {selectedInterview.qa_pairs.map((qa, index) => (
                        <Paper
                          key={index}
                          sx={{
                            p: 2,
                            mb: 2,
                            backgroundColor: "#f5f5f5",
                            "&:hover": {
                              backgroundColor: "#eeeeee",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: "bold",
                                color: "#1976d2",
                                flex: 1,
                              }}
                            >
                              Question {qa.questionIndex + 1}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 2 }}
                            >
                              {qa.timestamp
                                ? new Date(qa.timestamp).toLocaleString("fr-FR")
                                : "Non défini"}
                            </Typography>
                          </Box>

                          <Typography
                            variant="body1"
                            sx={{
                              mb: 2,
                              color: "#424242",
                              fontStyle: "italic",
                            }}
                          >
                            {qa.question}
                          </Typography>

                          <Box
                            sx={{
                              backgroundColor: "white",
                              p: 2,
                              borderRadius: 1,
                              border: "1px solid #e0e0e0",
                            }}
                          >
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              Réponse:
                            </Typography>
                            <Typography variant="body1">
                              {qa.answer || "Pas de réponse disponible"}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Fermer</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default InterviewSection;
