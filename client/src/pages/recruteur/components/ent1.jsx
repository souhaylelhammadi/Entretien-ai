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
} from "@mui/material";
import {
  PlayArrow,
  Visibility,
  Person,
  Business,
  Schedule,
  Description,
  X,
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
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    dispatch(clearSelectedInterview());
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
      <Box component="main" sx={{ flexGrow: 1, pt: "64px" }}>
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
                      <TableCell>{interview.offre?.titre || "N/A"}</TableCell>
                      <TableCell>{interview.candidat?.nom || "N/A"}</TableCell>
                      <TableCell>
                        {interview.date_prevue
                          ? format(
                              new Date(interview.date_prevue),
                              "dd MMM yyyy",
                              { locale: fr }
                            )
                          : "N/A"}
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-6xl h-[95vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <Typography variant="h5" component="div">
                    Détails de l'entretien
                  </Typography>
                  <IconButton onClick={handleCloseDialog} size="small">
                    <X className="w-6 h-6" />
                  </IconButton>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <Grid container spacing={3}>
                    {/* Vidéo */}
                    {selectedInterview?.video_url && (
                      <Grid item xs={12}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              Vidéo de l'entretien
                            </Typography>
                            <Box
                              sx={{
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

                    {/* Questions de l'entretien */}
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Questions de l'entretien
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          {selectedInterview?.questions ? (
                            selectedInterview.questions.map(
                              (question, index) => (
                                <Box key={index} sx={{ mb: 2 }}>
                                  <Typography
                                    variant="subtitle1"
                                    color="primary"
                                  >
                                    Question {index + 1}
                                  </Typography>
                                  <Typography variant="body1" sx={{ mb: 1 }}>
                                    {question.question}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    Type: {question.type}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    Objectif: {question.objectif}
                                  </Typography>
                                  <Divider sx={{ my: 1 }} />
                                </Box>
                              )
                            )
                          ) : (
                            <Typography variant="body1" color="text.secondary">
                              Aucune question disponible pour cet entretien
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Informations générales */}
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ display: "flex", alignItems: "center" }}
                          >
                            <Schedule sx={{ mr: 1 }} /> Informations générales
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              <strong>Statut:</strong>{" "}
                              {getStatusLabel(selectedInterview.statut)}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Date prévue:</strong>{" "}
                              {selectedInterview.date_prevue
                                ? format(
                                    new Date(selectedInterview.date_prevue),
                                    "dd MMMM yyyy",
                                    { locale: fr }
                                  )
                                : "Non définie"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Date de création:</strong>{" "}
                              {selectedInterview.date_creation
                                ? format(
                                    new Date(selectedInterview.date_creation),
                                    "dd MMMM yyyy",
                                    { locale: fr }
                                  )
                                : "Non définie"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Dernière mise à jour:</strong>{" "}
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

                    {/* Informations candidat */}
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ display: "flex", alignItems: "center" }}
                          >
                            <Person sx={{ mr: 1 }} /> Candidat
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              <strong>Nom:</strong>{" "}
                              {selectedInterview.candidat?.nom || "Non défini"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Email:</strong>{" "}
                              {selectedInterview.candidat?.email ||
                                "Non défini"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Téléphone:</strong>{" "}
                              {selectedInterview.candidat?.telephone ||
                                "Non défini"}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Informations offre */}
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ display: "flex", alignItems: "center" }}
                          >
                            <Business sx={{ mr: 1 }} /> Offre
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              <strong>Titre:</strong>{" "}
                              {selectedInterview.offre?.titre || "Non défini"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Entreprise:</strong>{" "}
                              {selectedInterview.offre?.entreprise ||
                                "Non définie"}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Localisation:</strong>{" "}
                              {selectedInterview.offre?.localisation ||
                                "Non définie"}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </div>
              </div>
            </div>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default InterviewSection;
