import React, { useEffect, useState } from 'react';
import { Button } from '../components';
import { useAuth } from '../hooks';
import firebase, { firestore, signInWithGoogle } from '../firebase';
import styled from 'styled-components';
import { Map, TileLayer, Marker } from 'react-leaflet';
import * as geofirestore from 'geofirestore';
import { useForm } from 'react-hook-form';
import API from '../api';
import L from 'leaflet';

const GeoFirestore = geofirestore.initializeApp(firestore);

const protestMarker = new L.Icon({
  iconUrl: '/icons/black-flag.svg',
  iconRetinaUrl: '/icons/black-flag.svg',
  iconSize: [50, 48],
  iconAnchor: [25, 48],
});

const archiveProtest = async (protestId) => {
  try {
    const archived = await API.archivePendingProtest(protestId);
    if (archived) {
      alert('success!');
    } else {
      alert(archived);
    }
  } catch (err) {
    alert('An error occured; check the console');
    console.error(err);
  }
};

/**
 * Add a new protest to the map and archive the pending one.
 * @param {*} params - The new protest parameters.
 * @param {*} pendingProtestId - The pending protest id.
 */
const createProtest = async (params, protestId) => {
  try {
    const a = await API.createProtest(params);
    const b = await API.archivePendingProtest(protestId);
    if (a === undefined && b === true) {
      return true;
    }
    return a;
  } catch (err) {
    alert('An error occured; check the console');
    console.error(err);
  }
};

const geocollection = GeoFirestore.collection('protests');
const getNearProtests = async (position) => {
  const query = geocollection.near({
    center: new firebase.firestore.GeoPoint(position[0], position[1]),
    radius: 2,
  });
  const snapshot = await query.limit(10).get();
  const protests = snapshot.docs.map((doc) => {
    const { latitude, longitude } = doc.data().g.geopoint;
    const protestLatlng = [latitude, longitude];
    return {
      id: doc.id,
      latlng: protestLatlng,
      ...doc.data(),
    };
  });
  return protests;
};

function Admin() {
  const authUser = useAuth();
  const [pendingProtests, setPendingProtests] = useState([]);
  const [currentProtest, setCurrentProtest] = useState({});
  const [currentPosition, setCurrentPosition] = useState([31.7749837, 35.219797]);
  const [nearbyProtests, setNearbyProtests] = useState([]);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    async function fetchProtests() {
      const snapshot = await firestore
        .collection('pending_protests')
        .where('archived', '!=', true)
        .orderBy('archived')
        .limit(25)
        .get();
      const protests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPendingProtests(protests);
    }
    fetchProtests();
  }, []);

  // Update map coordinates on protest select
  useEffect(() => {
    if (currentProtest.coordinates) {
      const currentPosition = [currentProtest.coordinates.latitude, currentProtest.coordinates.longitude];
      setCurrentPosition(currentPosition);
      getNearProtests(currentPosition)
        .then((protests) => {
          setNearbyProtests(protests);
        })
        .catch((err) => console.error(err));
    }
  }, [currentProtest]);

  const submitProtest = async (params) => {
    params.coords = currentPosition;
    const result = await createProtest(params, currentProtest.id);
    if (result) {
      setPendingProtests((prevState) => {
        const index = prevState.indexOf(currentProtest);
        const newPendingProtests = [...prevState.slice(0, index), ...prevState.slice(index + 1)];
        setCurrentProtest(prevState[index + 1]);
        reset(prevState[index + 1]);
        return newPendingProtests;
      });
    }
  };

  return (
    <AdminWrapper>
      {authUser ? (
        <>
          <PendingProtestsList>
            {pendingProtests.map((protest) => (
              <PendingCard
                onClick={() => {
                  setCurrentProtest(protest);
                  reset(protest);
                }}
                key={protest.id}
              >
                {protest.displayName || protest.streetAddress}
              </PendingCard>
            ))}
          </PendingProtestsList>
          <DetailsWrapper onSubmit={handleSubmit(submitProtest)}>
            <ProtestDetail>
              <ProtestDetailLabel>ID</ProtestDetailLabel>
              <ProtestDetailInput defaultValue={currentProtest.id} disabled />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>שם המקום</ProtestDetailLabel>
              <ProtestDetailInput name="displayName" defaultValue={currentProtest.displayName} ref={register} />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>רחוב</ProtestDetailLabel>
              <ProtestDetailInput name="streetAddress" defaultValue={currentProtest.streetAddress} ref={register} />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>קבוצת וואטסאפ</ProtestDetailLabel>
              <ProtestDetailInput name="whatsAppLink" defaultValue={currentProtest.whatsAppLink} ref={register} />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>קבוצת טלגרם</ProtestDetailLabel>
              <ProtestDetailInput name="telegramLink" defaultValue={currentProtest.telegramLink} ref={register} />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>הערות</ProtestDetailLabel>
              <ProtestDetailInput name="notes" defaultValue={currentProtest.notes} ref={register} />
            </ProtestDetail>
            <ProtestDetail>
              <ProtestDetailLabel>שעה</ProtestDetailLabel>
              <ProtestDetailInput name="meeting_time" type="time" defaultValue={currentProtest.meeting_time} ref={register} />
            </ProtestDetail>
            <Button type="submit" color="#1ED96E" style={{ marginBottom: 7.5 }}>
              יצירת הפגנה
            </Button>
            <Button color="tomato" onClick={() => archiveProtest(currentProtest.id)}>
              מחיקת הפגנה
            </Button>
          </DetailsWrapper>
          <MapWrapper
            center={currentPosition}
            zoom={17}
            onMove={(t) => {
              setCurrentPosition([t.target.getCenter().lat, t.target.getCenter().lng]);
            }}
          >
            <TileLayer
              attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={currentPosition}></Marker>
            {nearbyProtests.map((protest) => (
              <Marker position={protest.latlng} icon={protestMarker} key={protest.id}></Marker>
            ))}
          </MapWrapper>
        </>
      ) : (
        <Button onClick={signInWithGoogle}>התחבר למערכת</Button>
      )}
    </AdminWrapper>
  );
}

export default Admin;

const AdminWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr 3fr;
  padding: 20px;
`;

const PendingProtestsList = styled.div`
  display: grid;
  grid-auto-rows: 80px;
  gap: 15px;
`;

const PendingCard = styled.div`
  background-color: #fff;
`;

const DetailsWrapper = styled.form`
  justify-self: center;
`;

const ProtestDetail = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 10px;
  font-weight: 600;
`;

const ProtestDetailLabel = styled.label``;

const ProtestDetailInput = styled.input`
  width: 100%;
  padding: 6px 12px;
  margin-bottom: 0;
  font-size: 16px;
  border: 1px solid #d2d2d2;
  -webkit-appearance: none;
`;

const MapWrapper = styled(Map)`
  width: 100%;
  height: 80%;
  margin-bottom: 10px;
  z-index: 0;
`;