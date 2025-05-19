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
  Pagination,
} from "@mui/material";
import { PlayArrow, Visibility } from "@mui/icons-material";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const InterviewSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { interviews, selectedInterview, loading, error, pagination } =
    useSelector((state) => state.entretiens);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    dispatch(fetchRecruiterInterviews({ page: currentPage, perPage: 10 }));

    return () => {
      dispatch(clearError());
      dispatch(clearSelectedInterview());
    };
  }, [dispatch, currentPage, navigate]);

  const handleViewDetails = async (interviewId) => {
    try {
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

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
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
      case "En attente":
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
        <>
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
                        ? format(
                            new Date(interview.datePrevue),
                            "dd MMMM yyyy",
                            {
                              locale: fr,
                            }
                          )
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
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={pagination.pages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        </>
      )}

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedInterview && (
          <>
            <DialogTitle>Détails de l'entretien</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Informations générales
                </Typography>
                <Typography variant="body1">
                  Statut: {getStatusLabel(selectedInterview.statut)}
                </Typography>
                <Typography variant="body1">
                  Date prévue:{" "}
                  {selectedInterview.datePrevue
                    ? format(
                        new Date(selectedInterview.datePrevue),
                        "dd MMMM yyyy",
                        {
                          locale: fr,
                        }
                      )
                    : "Non définie"}
                </Typography>
                <Typography variant="body1">
                  Date de création:{" "}
                  {selectedInterview.dateCreation
                    ? format(
                        new Date(selectedInterview.dateCreation),
                        "dd MMMM yyyy",
                        {
                          locale: fr,
                        }
                      )
                    : "Non définie"}
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

                {selectedInterview.video?.url && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
                      Vidéo
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <video
                        controls
                        width="100%"
                        src={selectedInterview.video.url}
                      >
                        Votre navigateur ne supporte pas la lecture de vidéos.
                      </video>
                    </Box>
                  </>
                )}
              </Box>
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
