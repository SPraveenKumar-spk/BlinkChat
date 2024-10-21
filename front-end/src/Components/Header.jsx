import React from "react";
import logo from "../assets/logo.svg";
const Header = () => {
  return (
    <header
      style={{ height: "10vh" }}
      className="d-flex justify-content-between ps-5 pe-5 align-items-center bg-dark"
    >
      <div className="d-flex">
        <img
          src={logo}
          alt="logo"
          style={{ width: "3rem" }}
          className="me-2 bg-transparent"
        />
        <h1 className="text-light">BlinkChat</h1>
      </div>
    </header>
  );
};

export default Header;
