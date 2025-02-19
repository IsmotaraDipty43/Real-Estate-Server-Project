# HomeScape Backend API

This is the backend server for the **HomeScape** real estate platform. It provides authentication, property management, and secure transaction handling. The project uses **Node.js**, **Express**, **JWT** for authentication, and **MongoDB** for data storage.

## Features

- **Authentication**:
  - JWT-based authentication for secure user sessions.
  - Google login integration via Firebase for user-friendly authentication.
  - Password-based login and registration with email verification.

- **User Roles**:
  - Three roles: Admin, Agent, and Normal User.
  - Admins can promote users to Agents, declare fraudulent users, and manage all user accounts.
  - Fraudulent users have restricted functionalities like property listing.

- **CRUD Operations**:
  - Complete `GET`, `POST`, `PUT`, and `DELETE` methods for managing users, properties, and reviews.
  - Admins can approve or reject properties added by Agents.
  - Agents can update and delete their own property listings.

- **Stripe Payment Integration**:
  - Secure payment processing using the Stripe API for property purchases.
  - Users can make offers, and payment is processed only when an Agent accepts the offer.

- **Wishlist and Reviews**:
  - Users can add properties to their wishlist.
  - Users can leave reviews and ratings on properties, which Admins can manage.

- **Property Management**:
  - Admins approve or reject properties submitted by Agents before they are displayed.
  - Agents can add, update, and delete their properties.

- **Fraud Detection**:
  - Admins can declare users as fraudulent, which restricts their account and deletes their properties.

- **Advanced Queries**:
  - Use of MongoDB's aggregate functions for analytics and efficient data management.

- **Environment Variables**:
  - `.env` file for managing sensitive information like API keys, database credentials, and JWT secrets.


## Live Demo

[Live](https://realstate-server-rouge.vercel.app/)

## Frontend GitHub Link

[Frontend GitHub Repository](https://github.com/IsmotaraDipty43/HomeScape_Real-State-Client)

## Technology Stack

- **Backend Framework**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT, Firebase (Google Login)
- **Payment Gateway**: Stripe API
- **Environment Management**: `.env` file

