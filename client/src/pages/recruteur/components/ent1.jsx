import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchRecruiterInterviews,
  fetchInterviewDetails,
  clearError,
  clearSelectedInterview,
} from "../../store/recruteur/ent1slice";
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
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Container,
  Grid,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  Snackbar,
} from "@mui/material";
import {
  PlayArrow,
  Visibility,
  Person,
  Business,
  Schedule,
  Description,
  X,
  Message,
} from "@mui/icons-material";
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
  const [activeTab, setActiveTab] = useState(0);
  const [rapport, setRapport] = useState(null);
  const [loadingRapport, setLoadingRapport] = useState(false);
  const [openMessageDialog, setOpenMessageDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedInterviewForMessage, setSelectedInterviewForMessage] =
    useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

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

  const handleViewDetails = async (interviewId) => {
    try {
      console.log("Fetching details for interview:", interviewId);
      const result = await dispatch(
        fetchInterviewDetails(interviewId)
      ).unwrap();
      console.log("Interview details received:", result);
      console.log("Video data:", result.video);
      console.log("Video URL:", result.video?.url);
      setOpenDialog(true);

      // Récupérer le rapport
      setLoadingRapport(true);
      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000"
          }/api/recruteur/entretiens/${interviewId}/rapport`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Erreur lors de la récupération du rapport");
        }

        const data = await response.json();
        if (data.success) {
          setRapport(data.data.rapport);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du rapport:", error);
      } finally {
        setLoadingRapport(false);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    dispatch(clearSelectedInterview());
    setRapport(null);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
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

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedInterviewForMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL || "http://localhost:5000"
        }/api/recruteur/entretiens/${selectedInterviewForMessage.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ message: message.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors de l'envoi du message");
      }

      const data = await response.json();
      if (data.success) {
        setMessage("");
        setOpenMessageDialog(false);
        setSelectedInterviewForMessage(null);
        setNotification({
          open: true,
          message: "Message envoyé avec succès",
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      setNotification({
        open: true,
        message: "Erreur lors de l'envoi du message",
        severity: "error",
      });
    } finally {
      setSendingMessage(false);
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box component="main" sx={{ flexGrow: 1, pt: "10px" }}>
        {" "}
        {/* 64px est la hauteur standard d'une Toolbar */}
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {interviews.length === 0 ? (
            <Alert severity="info">Aucun entretien trouvé</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Offre</TableCell>
                    <TableCell>Candidat</TableCell>
                    <TableCell>Score</TableCell>
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
                      <TableCell>{interview.offre?.titre || "N/A"}</TableCell>
                      <TableCell>
                        <strong> Nom : {""}</strong>
                        {interview.candidat_id?.nom || "N/A"} <br />
                        <strong> Email :{""} </strong>
                        {interview.candidat_id?.email || "N/A"}
                        <br />
                        <strong> Telephone :{""} </strong>
                        {interview.candidat_id?.telephone || "N/A"}
                        <br />
                      </TableCell>
                      <TableCell>
                        {interview.rapport?.score_global ? (
                          <Chip
                            label={`${interview.rapport.score_global}/10`}
                            color={
                              interview.rapport.score_global >= 7
                                ? "success"
                                : interview.rapport.score_global >= 5
                                ? "warning"
                                : "error"
                            }
                            size="small"
                          />
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(interview.statut)}
                          color={getStatusColor(interview.statut)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
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

          {/* Modal pour les détails de l'entretien */}
          {selectedInterview && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 z-[9999]">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <Typography
                    variant="h5"
                    component="div"
                    className="font-semibold text-gray-800"
                  >
                    Détails de l'entretien
                  </Typography>
                  <IconButton
                    onClick={handleCloseDialog}
                    size="small"
                    className="hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </IconButton>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <Grid container spacing={4}>
                    {/* Vidéo */}
                    {selectedInterview?.video_url && (
                      <Grid item xs={12}>
                        <Card className="shadow-lg">
                          <CardContent className="p-4">
                            <Typography
                              variant="h6"
                              gutterBottom
                              className="font-semibold text-gray-800 mb-4"
                            >
                              Vidéo de l'entretien
                            </Typography>
                            <Box
                              sx={{
                                position: "relative",
                                width: "100%",
                                maxWidth: "800px",
                                margin: "0 auto",
                                paddingTop: "45%",
                                backgroundColor: "#000",
                                borderRadius: "12px",
                                overflow: "hidden",
                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
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
                                  backgroundColor: "#000",
                                }}
                                className="rounded-lg"
                                src={`${
                                  process.env.REACT_APP_API_URL ||
                                  "http://localhost:5000"
                                }/api/recruteur/entretiens/videos/${
                                  selectedInterview._id
                                }?token=${encodeURIComponent(
                                  localStorage.getItem("token")
                                )}`}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}

                    {/* Informations générales */}
                    <Grid item xs={12} md={4}>
                      <Card
                        sx={{ height: "100%" }}
                        className="shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <CardContent className="p-4">
                          <Typography
                            variant="h6"
                            gutterBottom
                            className="font-semibold text-gray-800 flex items-center"
                          >
                            <Schedule sx={{ mr: 1, color: "#4B5563" }} />{" "}
                            Informations générales
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">Statut:</strong>{" "}
                              <Chip
                                label={getStatusLabel(selectedInterview.statut)}
                                color={getStatusColor(selectedInterview.statut)}
                                size="small"
                                className="ml-2"
                              />
                            </Typography>

                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">
                                Date de création:
                              </strong>{" "}
                              {selectedInterview.date_creation
                                ? format(
                                    new Date(selectedInterview.date_creation),
                                    "dd MMMM yyyy",
                                    { locale: fr }
                                  )
                                : "Non définie"}
                            </Typography>
                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">
                                Dernière mise à jour:
                              </strong>{" "}
                              {selectedInterview.date_maj
                                ? format(
                                    new Date(selectedInterview.date_maj),
                                    "dd MMMM yyyy",
                                    { locale: fr }
                                  )
                                : "Non définie"}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Informations offre */}
                    <Grid item xs={12} md={4}>
                      <Card
                        sx={{ height: "100%" }}
                        className="shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <CardContent className="p-4">
                          <Typography
                            variant="h6"
                            gutterBottom
                            className="font-semibold text-gray-800 flex items-center"
                          >
                            <Business sx={{ mr: 1, color: "#4B5563" }} /> Offre
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">Titre:</strong>{" "}
                              {selectedInterview.offre?.titre || "Non défini"}
                            </Typography>
                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">
                                Entreprise:
                              </strong>{" "}
                              {selectedInterview.offre?.entreprise ||
                                "Non définie"}
                            </Typography>
                            <Typography
                              variant="body2"
                              className="text-gray-700"
                            >
                              <strong className="text-gray-900">
                                Localisation:
                              </strong>{" "}
                              {selectedInterview.offre?.localisation ||
                                "Non définie"}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Rapport d'évaluation */}
                    {selectedInterview.statut === "termine" && (
                      <Grid item xs={12}>
                        <Card className="shadow-lg">
                          <CardContent className="p-6">
                            <Typography
                              variant="h5"
                              gutterBottom
                              className="font-bold text-gray-800 mb-6"
                            >
                              Rapport d'évaluation
                            </Typography>
                            <Divider sx={{ my: 3 }} />

                            {loadingRapport ? (
                              <Box display="flex" justifyContent="center" p={4}>
                                <CircularProgress size={40} />
                              </Box>
                            ) : rapport ? (
                              <Box className="space-y-8">
                                {/* Score global */}
                                <Box className="bg-blue-50 p-6 rounded-xl">
                                  <Typography
                                    variant="h6"
                                    color="primary"
                                    className="font-bold text-2xl"
                                  >
                                    Score global: {rapport.score_global}/10
                                  </Typography>
                                </Box>

                                {/* Questions analysées */}
                                <Box className="space-y-6">
                                  <Typography
                                    variant="h6"
                                    className="font-bold text-gray-800 text-xl mb-4"
                                  >
                                    Analyse des questions
                                  </Typography>
                                  {rapport.questions_analysees.map(
                                    (qa, index) => (
                                      <Box
                                        key={index}
                                        className="bg-gray-50 p-6 rounded-xl shadow-sm"
                                      >
                                        <Typography
                                          variant="h6"
                                          className="font-bold text-gray-800 text-lg mb-3"
                                        >
                                          Question {index + 1}: {qa.question}
                                        </Typography>
                                        <Typography
                                          variant="body1"
                                          className="text-gray-700 text-base mb-3"
                                        >
                                          <strong className="text-gray-900">
                                            Réponse:
                                          </strong>{" "}
                                          {qa.reponse}
                                        </Typography>
                                        <Typography
                                          variant="body1"
                                          className="text-gray-700 text-base mb-3"
                                        >
                                          <strong className="text-gray-900">
                                            Analyse:
                                          </strong>{" "}
                                          {qa.analyse}
                                        </Typography>
                                        <Typography
                                          variant="h6"
                                          color="primary"
                                          className="font-bold text-lg mt-4"
                                        >
                                          Score: {qa.score}/10
                                        </Typography>
                                      </Box>
                                    )
                                  )}
                                </Box>

                                {/* Points forts */}
                                {rapport.points_forts &&
                                  rapport.points_forts.length > 0 && (
                                    <Box className="bg-green-50 p-6 rounded-xl">
                                      <Typography
                                        variant="h6"
                                        className="font-bold text-gray-800 text-xl mb-4"
                                      >
                                        Points forts
                                      </Typography>
                                      <List>
                                        {rapport.points_forts.map(
                                          (point, index) => (
                                            <ListItem
                                              key={index}
                                              className="py-2"
                                            >
                                              <ListItemText
                                                primary={
                                                  <Typography className="text-gray-700 text-base">
                                                    • {point}
                                                  </Typography>
                                                }
                                              />
                                            </ListItem>
                                          )
                                        )}
                                      </List>
                                    </Box>
                                  )}

                                {/* Conclusion */}
                                <Box className="bg-gray-50 p-6 rounded-xl">
                                  <Typography
                                    variant="h6"
                                    className="font-bold text-gray-800 text-xl mb-4"
                                  >
                                    Conclusion
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    className="text-gray-700 text-base leading-relaxed"
                                  >
                                    {rapport.conclusion}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Typography
                                variant="h6"
                                color="text.secondary"
                                className="text-center py-8 text-lg"
                              >
                                Aucun rapport disponible pour cet entretien
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                  </Grid>
                </div>
              </div>
            </div>
          )}

          {/* Dialog pour envoyer un message */}
          <Dialog
            open={openMessageDialog}
            onClose={() => {
              setOpenMessageDialog(false);
              setMessage("");
              setSelectedInterviewForMessage(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Envoyer un message pour l'entretien
              {selectedInterviewForMessage && (
                <Typography variant="subtitle2" color="textSecondary">
                  {selectedInterviewForMessage.candidat_id.nom}
                </Typography>
              )}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  label="Votre message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sendingMessage}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setOpenMessageDialog(false);
                  setMessage("");
                  setSelectedInterviewForMessage(null);
                }}
                disabled={sendingMessage}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSendMessage}
                variant="contained"
                color="primary"
                disabled={!message.trim() || sendingMessage}
              >
                {sendingMessage ? "Envoi..." : "Envoyer"}
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Box>

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InterviewSection;
